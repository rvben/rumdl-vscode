import * as vscode from 'vscode';
import * as TOML from '@iarna/toml';
import { GLOBAL_PROPERTIES, RULE_SCHEMAS, RULE_NAMES, RULE_ALIASES } from './configSchema';

// The rumdl schema declares [global] keys in kebab-case (the canonical form
// surfaced in docs and accepted by the CLI). The CLI's serde layer also
// accepts the snake_case alias of every key. Build a single lookup table that
// accepts both forms so the validator stays in lockstep with the schema and
// matches CLI behavior. Updates to schemas/rumdl.schema.json flow through
// GLOBAL_PROPERTIES via scripts/sync-schema.js with no separate maintenance.
const GLOBAL_KEY_TO_CANONICAL = new Map<string, string>();
for (const canonical of GLOBAL_PROPERTIES) {
  GLOBAL_KEY_TO_CANONICAL.set(canonical, canonical);
  const snake = canonical.replace(/-/g, '_');
  if (snake !== canonical) {
    GLOBAL_KEY_TO_CANONICAL.set(snake, canonical);
  }
}

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
   * @param isPyproject Whether `content` is a pyproject.toml document. When
   * true, rumdl config only lives under `[tool.rumdl]` / `[tool.rumdl.*]`;
   * every other top-level section belongs to some other tool (e.g.
   * `[build-system]`, `[tool.black]`) and is left unvalidated.
   * @returns Validation result with any errors
   */
  static validateToml(content: string, isPyproject = false): ConfigValidationResult {
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
    // The parsed-TOML object holding the keys of the section we're
    // currently inside, resolved up front when the section header is seen.
    // This lets the key/value loop below stay agnostic to whether we're
    // looking at .rumdl.toml (`parsed.rules.MD013`) or pyproject.toml
    // (`parsed.tool.rumdl.MD013`) shapes.
    let currentContainer: Record<string, unknown> | undefined;

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

        // In pyproject.toml, rumdl config only ever lives under [tool.rumdl]
        // or [tool.rumdl.*]. Every other top-level section belongs to some
        // other tool (e.g. [build-system], [project], [tool.black]); leave
        // it alone rather than flagging it as an unknown rumdl section.
        if (isPyproject && section !== 'tool.rumdl' && !section.startsWith('tool.rumdl.')) {
          currentSection = '';
          currentRule = '';
          currentContainer = undefined;
          continue;
        }

        const pyprojectRumdl = isPyproject ? this.getPyprojectRumdl(parsed) : undefined;

        // Handle tool.rumdl.* sections for pyproject.toml
        if (section.startsWith('tool.rumdl.')) {
          const subSection = section.substring(11); // Remove 'tool.rumdl.' prefix
          const ruleCode = this.resolveRuleName(subSection);

          if (ruleCode) {
            // [tool.rumdl.MD###] or [tool.rumdl.<rule-name-or-alias>]
            currentSection = section;
            currentRule = ruleCode;
            currentContainer = this.asObject(pyprojectRumdl?.[subSection]);
          } else if (subSection === 'per-file-ignores') {
            currentSection = 'per-file-ignores';
            currentRule = '';
            currentContainer = this.asObject(pyprojectRumdl?.['per-file-ignores']);
          } else if (subSection === 'per-file-flavor') {
            currentSection = 'per-file-flavor';
            currentRule = '';
            currentContainer = this.asObject(pyprojectRumdl?.['per-file-flavor']);
          } else if (subSection === 'global') {
            // [tool.rumdl.global] mirrors [global] in a .rumdl.toml file
            currentSection = 'global';
            currentRule = '';
            currentContainer = this.asObject(pyprojectRumdl?.['global']);
          } else {
            // Unknown tool.rumdl subsection
            currentSection = '';
            currentRule = '';
            currentContainer = undefined;
            errors.push({
              line: lineNum,
              column: 0,
              message:
                `Unknown section '[${section}]'. Valid sections are: [tool.rumdl], ` +
                `[tool.rumdl.per-file-ignores], [tool.rumdl.per-file-flavor], or ` +
                `[tool.rumdl.MD###] (rule name or alias, e.g. [tool.rumdl.line-length])`,
              severity: vscode.DiagnosticSeverity.Warning,
            });
          }
        } else if (section === 'tool.rumdl') {
          // [tool.rumdl] section for pyproject.toml global config
          currentSection = 'global';
          currentRule = '';
          currentContainer = pyprojectRumdl;
        } else if (section === 'rules') {
          // Check for rules section
          currentSection = 'rules';
          currentRule = '';
          currentContainer = this.asObject(parsed['rules']);
        } else if (section.startsWith('rules.')) {
          // Rule-specific section for .rumdl.toml
          const subName = section.substring(6);
          const ruleCode = this.resolveRuleName(subName);
          currentSection = section;

          if (ruleCode) {
            currentRule = ruleCode;
            const rulesObj = this.asObject(parsed['rules']);
            currentContainer = rulesObj ? this.asObject(rulesObj[subName]) : undefined;
          } else {
            currentRule = '';
            currentContainer = undefined;

            // Check for common mistakes
            const suggestion = this.findSimilarRule(subName);
            const message = suggestion
              ? `Unknown rule '${subName}'. Did you mean '${suggestion}'?`
              : `Unknown rule '${subName}'. Valid rules are: ${RULE_NAMES.join(', ')}`;

            errors.push({
              line: lineNum,
              column: section.indexOf(subName) + 1,
              message,
              severity: vscode.DiagnosticSeverity.Error,
            });
          }
        } else if (section === 'files' || section === 'global') {
          currentSection = section;
          currentRule = '';
          currentContainer = this.asObject(parsed[section]);
        } else if (section === 'per-file-ignores') {
          // [per-file-ignores] section for .rumdl.toml
          currentSection = 'per-file-ignores';
          currentRule = '';
          currentContainer = this.asObject(parsed['per-file-ignores']);
        } else if (section === 'per-file-flavor') {
          // [per-file-flavor] section for .rumdl.toml
          currentSection = 'per-file-flavor';
          currentRule = '';
          currentContainer = this.asObject(parsed['per-file-flavor']);
        } else {
          const ruleCode = this.resolveRuleName(section);
          if (ruleCode) {
            // Root-level [MD###] or [<rule-name-or-alias>] section
            // (shorthand for [rules.MD###])
            currentSection = section;
            currentRule = ruleCode;
            currentContainer = this.asObject(parsed[section]);
          } else {
            // Unknown section
            currentSection = '';
            currentRule = '';
            currentContainer = undefined;
            errors.push({
              line: lineNum,
              column: 0,
              message:
                `Unknown section '[${section}]'. Valid sections are: [rules], [files], ` +
                `[global], [per-file-ignores], [per-file-flavor], [MD###] (rule name or ` +
                `alias), or [rules.MD###] (or [rules.<alias>])`,
              severity: vscode.DiagnosticSeverity.Warning,
            });
          }
        }
        continue;
      }

      // Parse key-value pairs - but we can be more lenient now since TOML parser validated it.
      // Keys are either bare (letters/digits/underscore/hyphen) or quoted; quoted keys are
      // required for patterns like per-file-ignores/per-file-flavor globs ("docs/**/*.md"),
      // which contain characters ('/', '*', '.') that aren't valid in a bare TOML key.
      const kvMatch = trimmed.match(
        /^(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([a-zA-Z_][a-zA-Z0-9_-]*))\s*=/
      );
      if (!kvMatch) {
        // Not a key-value line, might be part of multiline value - skip
        continue;
      }

      const key = kvMatch[1] ?? kvMatch[2] ?? kvMatch[3];

      // Get value from the container resolved when we entered this section
      const value: unknown = currentContainer ? currentContainer[key] : undefined;

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
      } else if (currentSection === 'per-file-flavor') {
        // Validate per-file-flavor section keys
        this.validatePerFileFlavorSectionFromValue(key, value, lineNum, errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract the `[tool.rumdl]` table from a parsed pyproject.toml document.
   */
  private static getPyprojectRumdl(
    parsed: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    const tool = this.asObject(parsed.tool);
    return tool ? this.asObject(tool.rumdl) : undefined;
  }

  /**
   * Narrow a parsed TOML value to a plain table, excluding arrays and
   * scalars.
   */
  private static asObject(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  /**
   * Resolve a TOML section name to a canonical MD### rule code. Accepts the
   * code itself, the rule's canonical kebab-case name (e.g. 'line-length'
   * for MD013), or one of its extra aliases (e.g. 'single-title' for
   * MD025), all case-insensitively, matching what the rumdl CLI accepts.
   */
  private static resolveRuleName(name: string): string | null {
    const upper = name.toUpperCase();
    if (RULE_NAMES.includes(upper)) {
      return upper;
    }
    return RULE_ALIASES[name.toLowerCase()] ?? null;
  }

  /**
   * Find a similar rule name or alias for suggestions. Searches both MD###
   * codes and rule name/alias strings (e.g. 'line-length', 'single-title'),
   * preferring an MD### match when both are close.
   */
  private static findSimilarRule(input: string): string | null {
    const upperInput = input.toUpperCase();
    const lowerInput = input.toLowerCase();

    const codeMatch = RULE_NAMES.find(rule => {
      if (rule.includes(upperInput) || upperInput.includes(rule)) {
        return true;
      }
      return this.levenshteinDistance(rule, upperInput) <= 2;
    });
    if (codeMatch) {
      return codeMatch;
    }

    const aliasMatch = Object.keys(RULE_ALIASES).find(alias => {
      if (alias.includes(lowerInput) || lowerInput.includes(alias)) {
        return true;
      }
      return this.levenshteinDistance(alias, lowerInput) <= 2;
    });

    return aliasMatch ?? null;
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
   * Validate a [global] section property. Accepts both the canonical kebab-case
   * form declared by the schema and the snake_case alias accepted by the CLI;
   * downstream type checks key on the canonical kebab form.
   */
  private static validateGlobalSectionFromValue(
    key: string,
    value: unknown,
    line: number,
    errors: ValidationError[]
  ): void {
    const canonical = GLOBAL_KEY_TO_CANONICAL.get(key);
    if (canonical === undefined) {
      errors.push({
        line,
        column: 0,
        message:
          `Unknown property '${key}' in [global] section. ` +
          `Valid properties: ${GLOBAL_PROPERTIES.join(', ')}`,
        severity: vscode.DiagnosticSeverity.Warning,
      });
      return;
    }

    switch (canonical) {
      case 'respect-gitignore':
      case 'force-exclude':
      case 'cache':
        if (typeof value !== 'boolean') {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be true or false`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        if (canonical === 'force-exclude') {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' is deprecated. Use 'exclude' instead.`,
            severity: vscode.DiagnosticSeverity.Warning,
          });
        }
        break;

      case 'flavor':
      case 'output-format':
      case 'cache-dir':
        if (typeof value !== 'string') {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be a string`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        break;

      case 'line-length':
        if (typeof value !== 'number' || value < 0) {
          errors.push({
            line,
            column: 0,
            message: `Property '${key}' must be a positive number`,
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
        break;

      case 'enable':
      case 'disable':
      case 'exclude':
      case 'include':
      case 'fixable':
      case 'unfixable':
      case 'extend-enable':
      case 'extend-disable':
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

    // Validate that each item in the array is a valid rule name or alias
    for (const ruleName of value) {
      if (typeof ruleName !== 'string') {
        errors.push({
          line,
          column: 0,
          message: `Rule names in per-file-ignores must be strings`,
          severity: vscode.DiagnosticSeverity.Error,
        });
      } else if (!this.resolveRuleName(ruleName)) {
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
   * Validate per-file-flavor section properties from parsed value. Maps a
   * file pattern to a Markdown flavor string (e.g. "mkdocs"); mirrors the
   * [global] `flavor` property, which is likewise only type-checked and not
   * validated against a fixed enum so newly added flavors aren't rejected.
   */
  private static validatePerFileFlavorSectionFromValue(
    key: string,
    value: unknown,
    line: number,
    errors: ValidationError[]
  ): void {
    if (typeof value !== 'string') {
      errors.push({
        line,
        column: 0,
        message: `Value for pattern '${key}' must be a flavor string`,
        severity: vscode.DiagnosticSeverity.Error,
      });
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
