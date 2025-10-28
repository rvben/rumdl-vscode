import * as vscode from 'vscode';
import * as TOML from '@iarna/toml';
import { RULE_SCHEMAS, RULE_NAMES } from './configSchema';

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: vscode.DiagnosticSeverity;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validator for rumdl configuration files
 */
export class ConfigValidator {
  /**
   * Validate a TOML configuration string
   * @param content The TOML content to validate
   * @returns Validation result with any errors
   */
  static validateToml(content: string): ConfigValidationResult {
    const errors: ValidationError[] = [];

    // First, validate TOML syntax using proper parser
    let parsed: Record<string, unknown>;
    try {
      parsed = TOML.parse(content) as Record<string, unknown>;
    } catch (error) {
      // TOML parsing failed - report syntax error
      let line = 0;
      let message = 'Invalid TOML syntax';

      if (error instanceof Error) {
        message = error.message;
        // Try to extract line number from error message if available
        const lineMatch = error.message.match(/line (\d+)/i);
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10) - 1; // Convert to 0-indexed
        }
      }

      errors.push({
        line,
        column: 0,
        message,
        severity: vscode.DiagnosticSeverity.Error,
      });

      return {
        valid: false,
        errors,
      };
    }

    // TOML syntax is valid, now validate semantic rules
    // Parse line-by-line for detailed error reporting
    const lines = content.split('\n');
    let currentSection = '';
    let currentRule = '';

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Check for section headers
      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        const section = sectionMatch[1];

        // Handle tool.rumdl.* sections for pyproject.toml
        if (section.startsWith('tool.rumdl.')) {
          const subSection = section.substring(11); // Remove 'tool.rumdl.' prefix

          // Handle [tool.rumdl.MD###] - rule-specific sections
          if (RULE_NAMES.includes(subSection.toUpperCase())) {
            const ruleName = subSection.toUpperCase();
            currentSection = section;
            currentRule = ruleName;
          } else if (subSection === 'per-file-ignores') {
            // [tool.rumdl.per-file-ignores] section
            currentSection = 'per-file-ignores';
            currentRule = '';
          } else if (subSection === 'global') {
            // [tool.rumdl.global] is not used, just [tool.rumdl] for global config
            currentSection = 'global';
            currentRule = '';
          } else {
            // Unknown tool.rumdl subsection
            errors.push({
              line: lineNum,
              column: 0,
              message: `Unknown section '[${section}]'. Valid sections are: [tool.rumdl], [tool.rumdl.per-file-ignores], or [tool.rumdl.MD###]`,
              severity: vscode.DiagnosticSeverity.Warning,
            });
          }
        } else if (section === 'tool.rumdl') {
          // [tool.rumdl] section for pyproject.toml global config
          currentSection = 'global';
          currentRule = '';
        } else if (section === 'rules') {
          // Check for rules section
          currentSection = 'rules';
          currentRule = '';
        } else if (section.startsWith('rules.')) {
          // Rule-specific section for .rumdl.toml
          const ruleName = section.substring(6).toUpperCase();
          currentSection = section;
          currentRule = ruleName;

          // Validate rule name
          if (!RULE_NAMES.includes(ruleName)) {
            // Check for common mistakes
            const suggestion = this.findSimilarRule(ruleName);
            const message = suggestion
              ? `Unknown rule '${ruleName}'. Did you mean '${suggestion}'?`
              : `Unknown rule '${ruleName}'. Valid rules are: ${RULE_NAMES.join(', ')}`;

            errors.push({
              line: lineNum,
              column: section.indexOf(ruleName) + 1,
              message,
              severity: vscode.DiagnosticSeverity.Error,
            });
          }
        } else if (section === 'files' || section === 'global') {
          currentSection = section;
          currentRule = '';
        } else if (section === 'per-file-ignores') {
          // [per-file-ignores] section for .rumdl.toml
          currentSection = 'per-file-ignores';
          currentRule = '';
        } else if (section.startsWith('MD') && RULE_NAMES.includes(section.toUpperCase())) {
          // Root-level [MD###] sections (shorthand for [rules.MD###])
          const ruleName = section.toUpperCase();
          currentSection = section;
          currentRule = ruleName;
        } else {
          // Unknown section
          errors.push({
            line: lineNum,
            column: 0,
            message: `Unknown section '[${section}]'. Valid sections are: [rules], [files], [global], [per-file-ignores], [MD###], or [rules.MD###]`,
            severity: vscode.DiagnosticSeverity.Warning,
          });
        }
        continue;
      }

      // Parse key-value pairs - but we can be more lenient now since TOML parser validated it
      const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*=/);
      if (!kvMatch) {
        // Not a key-value line, might be part of multiline value - skip
        continue;
      }

      const key = kvMatch[1];

      // Get value from parsed structure instead of trying to parse the line
      let value: unknown = undefined;
      if (currentRule) {
        // For rule-specific sections like [rules.MD013], the structure is rules -> MD013 -> key
        if (parsed.rules && typeof parsed.rules === 'object') {
          const rulesObj = parsed.rules as Record<string, unknown>;
          if (rulesObj[currentRule] && typeof rulesObj[currentRule] === 'object') {
            value = (rulesObj[currentRule] as Record<string, unknown>)[key];
          }
        }
      } else if (
        currentSection &&
        parsed[currentSection] &&
        typeof parsed[currentSection] === 'object'
      ) {
        value = (parsed[currentSection] as Record<string, unknown>)[key];
      }

      // Validate based on current section
      if (currentRule) {
        // Validate rule-specific configuration
        this.validateRuleConfigFromValue(currentRule, key, value, lineNum, errors);
      } else if (currentSection === 'rules') {
        // Validate rules section keys
        this.validateRulesSectionFromValue(key, value, lineNum, errors);
      } else if (currentSection === 'files') {
        // Validate files section keys
        this.validateFilesSectionFromValue(key, value, lineNum, errors);
      } else if (currentSection === 'global') {
        // Validate global section keys
        this.validateGlobalSectionFromValue(key, value, lineNum, errors);
      } else if (currentSection === 'per-file-ignores') {
        // Validate per-file-ignores section keys
        this.validatePerFileIgnoresSectionFromValue(key, value, lineNum, errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Find a similar rule name for suggestions
   */
  private static findSimilarRule(input: string): string | null {
    const upperInput = input.toUpperCase();

    // Check for exact match first
    if (RULE_NAMES.includes(upperInput)) {
      return upperInput;
    }

    // Check for close matches
    const candidates = RULE_NAMES.filter(rule => {
      // Check if input is substring
      if (rule.includes(upperInput) || upperInput.includes(rule)) {
        return true;
      }

      // Check Levenshtein distance
      return this.levenshteinDistance(rule, upperInput) <= 2;
    });

    return candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(a: string, b: string): number {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Validate rule-specific configuration from parsed value
   */
  private static validateRuleConfigFromValue(
    ruleName: string,
    key: string,
    value: unknown,
    line: number,
    errors: ValidationError[]
  ): void {
    const schema = RULE_SCHEMAS[ruleName] as { properties?: Record<string, unknown> };
    if (!schema || !schema.properties) {
      return;
    }

    const propSchema = schema.properties[key];
    if (!propSchema) {
      // Unknown property for this rule
      const validProps = Object.keys(schema.properties);
      const message =
        validProps.length > 0
          ? `Unknown property '${key}' for rule ${ruleName}. Valid properties: ${validProps.join(', ')}`
          : `Rule ${ruleName} does not support configuration properties`;

      errors.push({
        line,
        column: 0,
        message,
        severity: vscode.DiagnosticSeverity.Warning,
      });
      return;
    }

    // Validate value type from parsed structure
    this.validateParsedValue(key, value, propSchema, line, errors);
  }

  /**
   * Validate rules section properties from parsed value
   */
  private static validateRulesSectionFromValue(
    key: string,
    value: unknown,
    line: number,
    errors: ValidationError[]
  ): void {
    const validKeys = ['select', 'ignore'];

    if (!validKeys.includes(key)) {
      errors.push({
        line,
        column: 0,
        message: `Unknown property '${key}' in [rules] section. Valid properties: ${validKeys.join(', ')}`,
        severity: vscode.DiagnosticSeverity.Warning,
      });
      return;
    }

    // Both should be arrays
    if (!Array.isArray(value)) {
      errors.push({
        line,
        column: 0,
        message: `Property '${key}' must be an array of rule names`,
        severity: vscode.DiagnosticSeverity.Error,
      });
    }
  }

  /**
   * Validate files section properties from parsed value
   */
  private static validateFilesSectionFromValue(
    key: string,
    value: unknown,
    line: number,
    errors: ValidationError[]
  ): void {
    const validKeys = ['include', 'exclude'];

    if (!validKeys.includes(key)) {
      errors.push({
        line,
        column: 0,
        message: `Unknown property '${key}' in [files] section. Valid properties: ${validKeys.join(', ')}`,
        severity: vscode.DiagnosticSeverity.Warning,
      });
      return;
    }

    // Both should be arrays
    if (!Array.isArray(value)) {
      errors.push({
        line,
        column: 0,
        message: `Property '${key}' must be an array of glob patterns`,
        severity: vscode.DiagnosticSeverity.Error,
      });
    }
  }

  /**
   * Validate global section properties from parsed value
   */
  private static validateGlobalSectionFromValue(
    key: string,
    value: unknown,
    line: number,
    errors: ValidationError[]
  ): void {
    const validKeys = ['enable', 'disable', 'exclude', 'include', 'respect_gitignore', 'flavor'];

    if (!validKeys.includes(key)) {
      errors.push({
        line,
        column: 0,
        message: `Unknown property '${key}' in [global] section. Valid properties: ${validKeys.join(', ')}`,
        severity: vscode.DiagnosticSeverity.Warning,
      });
      return;
    }

    // Validate types
    if (key === 'respect_gitignore') {
      if (typeof value !== 'boolean') {
        errors.push({
          line,
          column: 0,
          message: `Property '${key}' must be true or false`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    } else if (key === 'flavor') {
      if (typeof value !== 'string') {
        errors.push({
          line,
          column: 0,
          message: `Property '${key}' must be a string`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    } else {
      // All others should be arrays
      if (!Array.isArray(value)) {
        errors.push({
          line,
          column: 0,
          message: `Property '${key}' must be an array`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    }
  }

  /**
   * Validate per-file-ignores section properties from parsed value
   */
  private static validatePerFileIgnoresSectionFromValue(
    key: string,
    value: unknown,
    line: number,
    errors: ValidationError[]
  ): void {
    // Per-file-ignores is a map of file patterns to arrays of rule names
    // Key is a file pattern (glob), value should be an array of rule names
    if (!Array.isArray(value)) {
      errors.push({
        line,
        column: 0,
        message: `Value for pattern '${key}' must be an array of rule names`,
        severity: vscode.DiagnosticSeverity.Error,
      });
      return;
    }

    // Validate that each item in the array is a valid rule name
    for (const ruleName of value) {
      if (typeof ruleName !== 'string') {
        errors.push({
          line,
          column: 0,
          message: `Rule names in per-file-ignores must be strings`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      } else if (!RULE_NAMES.includes(ruleName.toUpperCase())) {
        errors.push({
          line,
          column: 0,
          message: `Unknown rule '${ruleName}' in per-file-ignores. Valid rules: ${RULE_NAMES.join(', ')}`,
          severity: vscode.DiagnosticSeverity.Warning,
        });
      }
    }
  }

  /**
   * Validate a parsed value against a schema
   */
  private static validateParsedValue(
    key: string,
    value: unknown,
    schema: { type?: string; minimum?: number; maximum?: number; enum?: string[] },
    line: number,
    errors: ValidationError[]
  ): void {
    switch (schema.type) {
      case 'number': {
        if (typeof value !== 'number') {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be a number`,
            severity: vscode.DiagnosticSeverity.Error,
          });
          return;
        }
        if (schema.minimum !== undefined && value < schema.minimum) {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be at least ${schema.minimum}`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be at most ${schema.maximum}`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        break;
      }

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be true or false`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be a string`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        } else if (schema.enum && !schema.enum.includes(value)) {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be one of: ${schema.enum.map((v: string) => `"${v}"`).join(', ')}`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be an array`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        break;
    }
  }

  /**
   * Validate rule-specific configuration (DEPRECATED: kept for backwards compatibility)
   */
  private static validateRuleConfig(
    ruleName: string,
    key: string,
    value: string,
    line: number,
    errors: ValidationError[]
  ): void {
    const schema = RULE_SCHEMAS[ruleName] as { properties?: Record<string, unknown> };
    if (!schema || !schema.properties) {
      return;
    }

    const propSchema = schema.properties[key];
    if (!propSchema) {
      // Unknown property for this rule
      const validProps = Object.keys(schema.properties);
      const message =
        validProps.length > 0
          ? `Unknown property '${key}' for rule ${ruleName}. Valid properties: ${validProps.join(', ')}`
          : `Rule ${ruleName} does not support configuration properties`;

      errors.push({
        line,
        column: 0,
        message,
        severity: vscode.DiagnosticSeverity.Warning,
      });
      return;
    }

    // Validate value type
    this.validateValue(key, value, propSchema, line, errors);
  }

  /**
   * Validate a value against a schema
   */
  private static validateValue(
    key: string,
    value: string,
    schema: { type?: string; minimum?: number; maximum?: number; enum?: string[] },
    line: number,
    errors: ValidationError[]
  ): void {
    const trimmedValue = value.trim();

    switch (schema.type) {
      case 'number': {
        const num = parseInt(trimmedValue, 10);
        if (isNaN(num)) {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be a number`,
            severity: vscode.DiagnosticSeverity.Error,
          });
          return;
        }
        if (schema.minimum !== undefined && num < schema.minimum) {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be at least ${schema.minimum}`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        if (schema.maximum !== undefined && num > schema.maximum) {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be at most ${schema.maximum}`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        break;
      }

      case 'boolean':
        if (trimmedValue !== 'true' && trimmedValue !== 'false') {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be true or false`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        break;

      case 'string':
        if (schema.enum && trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
          const stringValue = trimmedValue.slice(1, -1);
          if (!schema.enum.includes(stringValue)) {
            errors.push({
              line,
              column: 0,
              message: `Property '${key}' must be one of: ${schema.enum.map((v: string) => `"${v}"`).join(', ')}`,
              severity: vscode.DiagnosticSeverity.Error,
            });
          }
        }
        break;

      case 'array':
        if (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']')) {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be an array`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        break;
    }
  }

  /**
   * Validate rules section properties
   */
  private static validateRulesSection(
    key: string,
    value: string,
    line: number,
    errors: ValidationError[]
  ): void {
    const validKeys = ['select', 'ignore'];

    if (!validKeys.includes(key)) {
      errors.push({
        line,
        column: 0,
        message: `Unknown property '${key}' in [rules] section. Valid properties: ${validKeys.join(', ')}`,
        severity: vscode.DiagnosticSeverity.Warning,
      });
      return;
    }

    // Both should be arrays
    if (!value.trim().startsWith('[') || !value.trim().endsWith(']')) {
      errors.push({
        line,
        column: 0,
        message: `Property '${key}' must be an array of rule names`,
        severity: vscode.DiagnosticSeverity.Error,
      });
    }
  }

  /**
   * Validate files section properties
   */
  private static validateFilesSection(
    key: string,
    value: string,
    line: number,
    errors: ValidationError[]
  ): void {
    const validKeys = ['include', 'exclude'];

    if (!validKeys.includes(key)) {
      errors.push({
        line,
        column: 0,
        message: `Unknown property '${key}' in [files] section. Valid properties: ${validKeys.join(', ')}`,
        severity: vscode.DiagnosticSeverity.Warning,
      });
      return;
    }

    // Both should be arrays
    if (!value.trim().startsWith('[') || !value.trim().endsWith(']')) {
      errors.push({
        line,
        column: 0,
        message: `Property '${key}' must be an array of glob patterns`,
        severity: vscode.DiagnosticSeverity.Error,
      });
    }
  }

  /**
   * Validate global section properties
   */
  private static validateGlobalSection(
    key: string,
    value: string,
    line: number,
    errors: ValidationError[]
  ): void {
    const validKeys = ['enable', 'disable', 'exclude', 'include', 'respect_gitignore'];

    if (!validKeys.includes(key)) {
      errors.push({
        line,
        column: 0,
        message: `Unknown property '${key}' in [global] section. Valid properties: ${validKeys.join(', ')}`,
        severity: vscode.DiagnosticSeverity.Warning,
      });
      return;
    }

    // Validate types
    if (key === 'respect_gitignore') {
      if (value.trim() !== 'true' && value.trim() !== 'false') {
        errors.push({
          line,
          column: 0,
          message: `Property '${key}' must be true or false`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    } else {
      // All others should be arrays
      if (!value.trim().startsWith('[') || !value.trim().endsWith(']')) {
        errors.push({
          line,
          column: 0,
          message: `Property '${key}' must be an array`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    }
  }

  /**
   * Get quick fixes for validation errors
   */
  static getQuickFixes(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction[] {
    const fixes: vscode.CodeAction[] = [];
    const diagnosticMessage = diagnostic.message;

    // Fix for unknown rule suggestions
    const ruleMatch = diagnosticMessage.match(/Unknown rule '(.+)'\. Did you mean '(.+)'\?/);
    if (ruleMatch) {
      const [, wrongRule, correctRule] = ruleMatch;
      const fix = new vscode.CodeAction(
        `Change to '${correctRule}'`,
        vscode.CodeActionKind.QuickFix
      );
      fix.edit = new vscode.WorkspaceEdit();

      // Find the rule name in the line and replace it
      const line = document.lineAt(diagnostic.range.start.line);
      const ruleIndex = line.text.indexOf(wrongRule);
      if (ruleIndex >= 0) {
        const range = new vscode.Range(
          diagnostic.range.start.line,
          ruleIndex,
          diagnostic.range.start.line,
          ruleIndex + wrongRule.length
        );
        fix.edit.replace(document.uri, range, correctRule);
      }

      fixes.push(fix);
    }

    // Fix for boolean values
    if (diagnosticMessage.includes('must be true or false')) {
      const line = document.lineAt(diagnostic.range.start.line);
      const equalIndex = line.text.indexOf('=');
      if (equalIndex >= 0) {
        const valueStart = line.text.substring(equalIndex + 1).search(/\S/) + equalIndex + 1;
        const range = new vscode.Range(
          diagnostic.range.start.line,
          valueStart,
          diagnostic.range.start.line,
          line.text.length
        );

        ['true', 'false'].forEach(value => {
          const fix = new vscode.CodeAction(`Change to ${value}`, vscode.CodeActionKind.QuickFix);
          fix.edit = new vscode.WorkspaceEdit();
          fix.edit.replace(document.uri, range, value);
          fixes.push(fix);
        });
      }
    }

    return fixes;
  }
}
