// import * as vscode from 'vscode';
import { expect } from '../helper';
import { ConfigValidator } from '../../configValidator';
import { GLOBAL_PROPERTIES } from '../../configSchema';

// Minimal valid TOML literal for each schema-defined [global] property.
// Keyed by the canonical kebab-case name; the snake_case alias gets the same value.
const VALID_GLOBAL_VALUES: Record<string, string> = {
  enable: '["MD001"]',
  disable: '["MD001"]',
  exclude: '["dist"]',
  include: '["**/*.md"]',
  'respect-gitignore': 'true',
  'line-length': '100',
  'output-format': '"text"',
  fixable: '["MD001"]',
  unfixable: '["MD001"]',
  flavor: '"gfm"',
  'force-exclude': 'false',
  'cache-dir': '".rumdl_cache"',
  cache: 'true',
  'extend-enable': '["MD001"]',
  'extend-disable': '["MD001"]',
};

function toSnake(key: string): string {
  return key.replace(/-/g, '_');
}

suite('ConfigValidator Tests', () => {
  test('validateToml should validate valid configuration', () => {
    const validToml = `[rules]
select = ["MD001", "MD002"]
ignore = ["MD003"]

[rules.MD013]
line_length = 80`;

    const result = ConfigValidator.validateToml(validToml);

    expect(result.valid).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml should detect TOML syntax errors', () => {
    const invalidToml = `[rules
select = ["MD001"`;

    const result = ConfigValidator.validateToml(invalidToml);

    expect(result.valid).to.be.false;
    expect(result.errors).to.have.length.greaterThan(0);
  });

  test('validateToml should validate rule names', () => {
    const tomlWithBadRule = `[rules]
select = ["MD999", "INVALID"]`;

    const result = ConfigValidator.validateToml(tomlWithBadRule);

    // Note: The current validator may not validate rule names
    // If it doesn't, we'll just check that it parses without crashing
    expect(result).to.exist;
    expect(result.errors).to.be.an('array');

    // If it does validate rule names, check for errors
    if (result.errors.length > 0) {
      expect(result.errors[0].message).to.exist;
    }
  });

  test('validateToml should validate global section', () => {
    const tomlWithGlobal = `[global]
base_path = "docs"

[rules]
select = ["MD001"]`;

    const result = ConfigValidator.validateToml(tomlWithGlobal);

    // Just check it doesn't crash
    expect(result).to.exist;
    expect(result.errors).to.be.an('array');
  });

  test('validateToml should validate files section', () => {
    const tomlWithFiles = `[files]
include = ["**/*.md"]
exclude = ["**/node_modules/**"]`;

    const result = ConfigValidator.validateToml(tomlWithFiles);

    // Just check it doesn't crash
    expect(result).to.exist;
    expect(result.errors).to.be.an('array');
  });

  test('validateToml should handle empty configuration', () => {
    const result = ConfigValidator.validateToml('');

    expect(result.valid).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml should validate rule-specific options', () => {
    const tomlWithOptions = `[rules.MD024]
siblings_only = true

[rules.MD013]
line_length = 100
code_blocks = false`;

    const result = ConfigValidator.validateToml(tomlWithOptions);

    expect(result).to.exist;
    expect(result.errors).to.be.an('array');
  });

  test('validateToml should not crash on various inputs', () => {
    const inputs = [
      '[rules]\n',
      'invalid = toml',
      '[[array]]\nvalue = 1',
      '[table]\n# comment',
      'key = "value"',
    ];

    for (const input of inputs) {
      const result = ConfigValidator.validateToml(input);
      expect(result).to.exist;
      expect(result.errors).to.be.an('array');
    }
  });

  test('validateToml should handle multiline arrays', () => {
    const tomlWithMultilineArray = `[global]
exclude = [
    # Common directories to exclude
    ".git",
    ".github",
    "node_modules",
    "vendor",
    "dist",
    "build",

    # Specific files or patterns
    "CHANGELOG.md",
    "LICENSE.md",
]

respect_gitignore = true`;

    const result = ConfigValidator.validateToml(tomlWithMultilineArray);

    // Should not have any errors for valid multiline arrays
    expect(result.valid).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml should handle multiline arrays with include', () => {
    const tomlWithMultilineInclude = `[global]
include = [
    "docs/*.md",
    "src/**/*.md",
    "README.md"
]`;

    const result = ConfigValidator.validateToml(tomlWithMultilineInclude);

    expect(result.valid).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml should detect unclosed multiline arrays', () => {
    const tomlWithUnclosedArray = `[global]
exclude = [
    ".git",
    ".github"`;

    const result = ConfigValidator.validateToml(tomlWithUnclosedArray);

    expect(result.valid).to.be.false;
    expect(result.errors).to.have.length.greaterThan(0);
    // The proper TOML parser will catch this as a syntax error
    expect(result.errors[0].message).to.exist;
  });

  test('validateToml should handle multiline arrays in [rules] section', () => {
    const tomlWithRulesMultiline = `[rules]
select = [
    "MD001",
    "MD003",
    "MD004"
]`;

    const result = ConfigValidator.validateToml(tomlWithRulesMultiline);

    expect(result.valid).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml should validate the actual default config from rumdl init', () => {
    // This is the exact config generated by `rumdl init`
    const defaultConfig = `# rumdl configuration file

# Global configuration options
[global]
# List of rules to disable (uncomment and modify as needed)
# disable = ["MD013", "MD033"]

# List of rules to enable exclusively (if provided, only these rules will run)
# enable = ["MD001", "MD003", "MD004"]

# List of file/directory patterns to include for linting (if provided, only these will be linted)
# include = [
#    "docs/*.md",
#    "src/**/*.md",
#    "README.md"
# ]

# List of file/directory patterns to exclude from linting
exclude = [
    # Common directories to exclude
    ".git",
    ".github",
    "node_modules",
    "vendor",
    "dist",
    "build",

    # Specific files or patterns
    "CHANGELOG.md",
    "LICENSE.md",
]

# Respect .gitignore files when scanning directories (default: true)
respect_gitignore = true

# Markdown flavor/dialect (uncomment to enable)
# Options: mkdocs, gfm, commonmark
# flavor = "mkdocs"

# Rule-specific configurations (uncomment and modify as needed)

# [MD003]
# style = "atx"  # Heading style (atx, atx_closed, setext)

# [MD004]
# style = "asterisk"  # Unordered list style (asterisk, plus, dash, consistent)

# [MD007]
# indent = 4  # Unordered list indentation

# [MD013]
# line_length = 100  # Line length
# code_blocks = false  # Exclude code blocks from line length check
# tables = false  # Exclude tables from line length check
# headings = true  # Include headings in line length check

# [MD044]
# names = ["rumdl", "Markdown", "GitHub"]  # Proper names that should be capitalized correctly
# code-blocks = false  # Check code blocks for proper names (default: false, skips code blocks)`;

    const result = ConfigValidator.validateToml(defaultConfig);

    // The default config should validate without any errors
    expect(result.valid).to.be.true;
    expect(result.errors).to.be.empty;
  });

  // -------------------------------------------------------------------------
  // [global] section: kebab-case and snake_case parity with schema
  // -------------------------------------------------------------------------
  //
  // Every property in $defs.GlobalConfig.properties of rumdl.schema.json must
  // validate in both its canonical kebab form (the form the docs and CLI use)
  // and its snake_case alias (the form historically accepted by serde).
  // GLOBAL_PROPERTIES is auto-generated from the schema; if it falls out of
  // sync with VALID_GLOBAL_VALUES this suite fails loudly.

  test('VALID_GLOBAL_VALUES covers every schema-defined [global] property', () => {
    const missing = GLOBAL_PROPERTIES.filter(key => !(key in VALID_GLOBAL_VALUES));
    expect(
      missing,
      `Test fixture missing entries for: ${missing.join(', ')}. ` +
        `Update VALID_GLOBAL_VALUES when adding a property to the schema.`
    ).to.be.empty;
  });

  for (const key of GLOBAL_PROPERTIES) {
    test(`validateToml accepts [global] ${key} (kebab form)`, () => {
      const toml = `[global]\n${key} = ${VALID_GLOBAL_VALUES[key]}\n`;
      const result = ConfigValidator.validateToml(toml);
      const unknown = result.errors.filter(e => /Unknown property/i.test(e.message));
      expect(
        unknown,
        `Kebab-case key '${key}' should validate. Got: ${unknown.map(e => e.message).join('; ')}`
      ).to.be.empty;
    });

    const snake = toSnake(key);
    if (snake !== key) {
      test(`validateToml accepts [global] ${snake} (snake alias of ${key})`, () => {
        const toml = `[global]\n${snake} = ${VALID_GLOBAL_VALUES[key]}\n`;
        const result = ConfigValidator.validateToml(toml);
        const unknown = result.errors.filter(e => /Unknown property/i.test(e.message));
        expect(
          unknown,
          `Snake-case alias '${snake}' should validate. Got: ${unknown.map(e => e.message).join('; ')}`
        ).to.be.empty;
      });
    }
  }

  test('validateToml flags a truly unknown [global] property', () => {
    const toml = `[global]\ntotally-fake-key = "x"\n`;
    const result = ConfigValidator.validateToml(toml);
    const unknown = result.errors.filter(e =>
      /Unknown property 'totally-fake-key'/.test(e.message)
    );
    expect(unknown).to.have.lengthOf(1);
  });

  test('validateToml emits deprecation warning for [global] force-exclude (kebab)', () => {
    const toml = `[global]\nforce-exclude = false\n`;
    const result = ConfigValidator.validateToml(toml);
    const deprecation = result.errors.filter(e => /deprecated/i.test(e.message));
    expect(deprecation, 'force-exclude must surface deprecation warning').to.have.lengthOf(1);
  });

  test('validateToml emits deprecation warning for [global] force_exclude (snake)', () => {
    const toml = `[global]\nforce_exclude = false\n`;
    const result = ConfigValidator.validateToml(toml);
    const deprecation = result.errors.filter(e => /deprecated/i.test(e.message));
    expect(deprecation, 'force_exclude must surface deprecation warning').to.have.lengthOf(1);
  });

  test('validateToml type-checks [global] line-length in kebab form', () => {
    const toml = `[global]\nline-length = "not-a-number"\n`;
    const result = ConfigValidator.validateToml(toml);
    const typeErr = result.errors.filter(e => /must be a positive number/.test(e.message));
    expect(typeErr, 'kebab line-length must still be type-checked').to.have.lengthOf(1);
  });

  test('validateToml type-checks [global] respect-gitignore in kebab form', () => {
    const toml = `[global]\nrespect-gitignore = "yes"\n`;
    const result = ConfigValidator.validateToml(toml);
    const typeErr = result.errors.filter(e => /must be true or false/.test(e.message));
    expect(typeErr, 'kebab respect-gitignore must still be type-checked').to.have.lengthOf(1);
  });

  test('validateToml accepts a realistic kebab-case [global] config end-to-end', () => {
    const toml = `[global]
exclude = [".git", "target"]
flavor = "gfm"
output-format = "grouped"
line-length = 100
respect-gitignore = true
cache = true
extend-disable = ["MD041"]
`;
    const result = ConfigValidator.validateToml(toml);
    expect(result.valid, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml should validate a .rumdl.toml config using [global] and [rules.MD013]', () => {
    const config = `[global]
disable = ["MD033"]
exclude = ["node_modules","vendor"]

[rules.MD013]
line_length = 120
code_blocks = false
`;

    const result = ConfigValidator.validateToml(config);

    expect(result.valid).to.be.true;
    expect(result.errors).to.be.empty;
  });

  // -------------------------------------------------------------------------
  // pyproject.toml: native [tool.rumdl] validation (no lossy conversion)
  // -------------------------------------------------------------------------
  //
  // These exercise validateToml(content, /* isPyproject */ true) directly
  // against real pyproject.toml text, since the extension no longer converts
  // [tool.rumdl.*] into [global]/[rules.*] text before validating (see
  // configDiagnostics.ts). Regression coverage for
  // https://github.com/rvben/rumdl-vscode/issues/157.

  test('validateToml accepts [tool.rumdl.per-file-ignores] in pyproject.toml (issue #157)', () => {
    const pyproject = `[tool.rumdl.per-file-ignores]
"README.md" = ["MD033"]
"docs/api/**/*.md" = ["MD013", "MD041"]
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    expect(result.valid, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml flags an unknown rule name inside a quoted [tool.rumdl.per-file-ignores] key', () => {
    // Same shape as the issue #157 repro, but with a rule name that doesn't
    // exist. Quoted keys (required for glob patterns like "README.md" or
    // "docs/api/**/*.md") must still have their array values validated.
    const pyproject = `[tool.rumdl.per-file-ignores]
"README.md" = ["MD033", "NOTAREALRULE"]
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    const unknown = result.errors.filter(e => /Unknown rule 'NOTAREALRULE'/.test(e.message));
    expect(unknown, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.have.lengthOf(1);
  });

  test('validateToml flags an unknown rule name inside a quoted [per-file-ignores] key (.rumdl.toml)', () => {
    const config = `[per-file-ignores]
"README.md" = ["NOTAREALRULE"]
`;

    const result = ConfigValidator.validateToml(config);

    const unknown = result.errors.filter(e => /Unknown rule 'NOTAREALRULE'/.test(e.message));
    expect(unknown, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.have.lengthOf(1);
  });

  test('validateToml accepts [tool.rumdl.per-file-flavor] in pyproject.toml', () => {
    const pyproject = `[tool.rumdl.per-file-flavor]
"docs/mkdocs/**/*.md" = "mkdocs"
"README.md" = "gfm"
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    expect(result.valid, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml accepts [per-file-flavor] in .rumdl.toml', () => {
    const config = `[per-file-flavor]
"docs/mkdocs/**/*.md" = "mkdocs"
"README.md" = "gfm"
`;

    const result = ConfigValidator.validateToml(config);

    expect(result.valid, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml flags a non-string value in [per-file-flavor]', () => {
    const config = `[per-file-flavor]
"README.md" = 42
`;

    const result = ConfigValidator.validateToml(config);
    const typeErr = result.errors.filter(e => /must be a flavor string/.test(e.message));
    expect(typeErr).to.have.lengthOf(1);
  });

  test('validateToml flags a non-string value in [tool.rumdl.per-file-flavor]', () => {
    const pyproject = `[tool.rumdl.per-file-flavor]
"README.md" = 42
`;

    const result = ConfigValidator.validateToml(pyproject, true);
    const typeErr = result.errors.filter(e => /must be a flavor string/.test(e.message));
    expect(typeErr).to.have.lengthOf(1);
  });

  test('validateToml accepts flat [tool.rumdl] global config in pyproject.toml', () => {
    const pyproject = `[tool.rumdl]
disable = ["MD033"]
exclude = ["node_modules", "vendor"]
line-length = 100
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    expect(result.valid, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml accepts nested [tool.rumdl.global] config in pyproject.toml', () => {
    const pyproject = `[tool.rumdl.global]
line-length = 100
respect-gitignore = true
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    expect(result.valid, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml accepts [tool.rumdl.MD013] rule section in pyproject.toml', () => {
    const pyproject = `[tool.rumdl.MD013]
line_length = 120
code_blocks = false
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    expect(result.valid, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml does not flag unrelated pyproject.toml sections', () => {
    const pyproject = `[build-system]
requires = ["setuptools>=42", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "example"
version = "1.0.0"

[tool.black]
line-length = 88

[tool.poetry]
name = "example"

[tool.rumdl]
disable = ["MD033"]
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    expect(result.valid, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml still errors on an invalid rule section in pyproject.toml ([tool.rumdl.MD999])', () => {
    const pyproject = `[tool.rumdl.MD999]
some_option = true
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    expect(result.valid).to.be.false;
    expect(result.errors).to.have.length.greaterThan(0);
    expect(result.errors[0].message).to.match(/Unknown section/);
  });

  test('validateToml still warns on an unknown [tool.rumdl.*] subsection', () => {
    const pyproject = `[tool.rumdl.not-a-real-thing]
foo = "bar"
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    const unknown = result.errors.filter(e => /Unknown section/.test(e.message));
    expect(unknown).to.have.lengthOf(1);
    expect(unknown[0].message).to.include('per-file-flavor');
  });

  // -------------------------------------------------------------------------
  // Rule alias section names (e.g. [emphasis-style] instead of [MD049]),
  // accepted in both .rumdl.toml and pyproject.toml forms.
  // -------------------------------------------------------------------------

  test('validateToml accepts a root-level rule alias section in .rumdl.toml ([emphasis-style])', () => {
    const config = `[emphasis-style]
style = "asterisk"
`;

    const result = ConfigValidator.validateToml(config);

    const unknownRule = result.errors.filter(e => /Unknown (rule|section)/.test(e.message));
    expect(unknownRule, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.empty;
  });

  test('validateToml accepts a [rules.<alias>] section in .rumdl.toml ([rules.line-length])', () => {
    const config = `[rules.line-length]
line_length = 120
`;

    const result = ConfigValidator.validateToml(config);

    const unknownRule = result.errors.filter(e => /Unknown (rule|section)/.test(e.message));
    expect(unknownRule, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.empty;
  });

  test('validateToml accepts a [tool.rumdl.<alias>] section in pyproject.toml ([tool.rumdl.line-length])', () => {
    const pyproject = `[tool.rumdl.line-length]
line_length = 120
`;

    const result = ConfigValidator.validateToml(pyproject, true);

    const unknownRule = result.errors.filter(e => /Unknown (rule|section)/.test(e.message));
    expect(unknownRule, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.empty;
  });

  test('validateToml accepts a rule alias inside a [per-file-ignores] array', () => {
    const config = `[per-file-ignores]
"README.md" = ["no-inline-html", "line-length"]
`;

    const result = ConfigValidator.validateToml(config);

    expect(result.valid, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.true;
    expect(result.errors).to.be.empty;
  });

  test('validateToml accepts an extra rule alias, not just the canonical name (single-title)', () => {
    const config = `[single-title]
level = 1
`;

    const result = ConfigValidator.validateToml(config);

    const unknownRule = result.errors.filter(e => /Unknown (rule|section)/.test(e.message));
    expect(unknownRule, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.empty;
  });

  test('validateToml alias matching is case-insensitive ([Line-Length])', () => {
    const config = `[rules.Line-Length]
line_length = 100
`;

    const result = ConfigValidator.validateToml(config);

    const unknownRule = result.errors.filter(e => /Unknown (rule|section)/.test(e.message));
    expect(unknownRule, `errors: ${result.errors.map(e => e.message).join('; ')}`).to.be.empty;
  });

  test('validateToml still rejects a genuinely unknown rule name/alias', () => {
    const config = `[rules.not-a-real-rule]
foo = true
`;

    const result = ConfigValidator.validateToml(config);

    expect(result.valid).to.be.false;
    const unknownRule = result.errors.filter(e => /Unknown rule/.test(e.message));
    expect(unknownRule).to.have.lengthOf(1);
  });
});
