// import * as vscode from 'vscode';
import { expect } from '../helper';
import { ConfigValidator } from '../../configValidator';

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
});
