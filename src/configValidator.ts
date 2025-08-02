import * as vscode from 'vscode';
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
    const lines = content.split('\n');

    // Track current section
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

        // Check for rules section
        if (section === 'rules') {
          currentSection = 'rules';
          currentRule = '';
        } else if (section.startsWith('rules.')) {
          // Rule-specific section
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
        } else {
          // Unknown section
          errors.push({
            line: lineNum,
            column: 0,
            message: `Unknown section '[${section}]'. Valid sections are: [rules], [files], [global], or [rules.MD###]`,
            severity: vscode.DiagnosticSeverity.Warning,
          });
        }
        continue;
      }

      // Parse key-value pairs
      const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (!kvMatch) {
        errors.push({
          line: lineNum,
          column: 0,
          message: 'Invalid syntax. Expected: key = value',
          severity: vscode.DiagnosticSeverity.Error,
        });
        continue;
      }

      const [, key, value] = kvMatch;

      // Validate based on current section
      if (currentRule) {
        // Validate rule-specific configuration
        this.validateRuleConfig(currentRule, key, value, lineNum, errors);
      } else if (currentSection === 'rules') {
        // Validate rules section keys
        this.validateRulesSection(key, value, lineNum, errors);
      } else if (currentSection === 'files') {
        // Validate files section keys
        this.validateFilesSection(key, value, lineNum, errors);
      } else if (currentSection === 'global') {
        // Validate global section keys
        this.validateGlobalSection(key, value, lineNum, errors);
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
   * Validate rule-specific configuration
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
