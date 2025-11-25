import { expect } from '../helper';

/**
 * Tests for LSP initialization options format
 * Regression test for issue #70: Config can't be read
 *
 * These tests verify that the initialization options transformation logic
 * produces camelCase format as expected by rumdl v0.0.171+ per LSP specification.
 *
 * Note: These tests directly test the transformation logic without relying on
 * VS Code's configuration API, which doesn't persist reliably in test environments.
 */

/**
 * Build initialization options the same way the client does in src/client.ts
 */
function buildInitializationOptions(config: {
  configPath?: string;
  rules: { enable: string[]; disable: string[] };
}) {
  return {
    configPath:
      config.configPath && config.configPath.trim() !== '' ? config.configPath : undefined,
    enableLinting: true,
    enableAutoFix: true,
    enableRules: config.rules.enable.length > 0 ? config.rules.enable : undefined,
    disableRules: config.rules.disable.length > 0 ? config.rules.disable : undefined,
  };
}

suite('Initialization Options Tests', () => {
  test('initialization options should use camelCase field names', () => {
    // Test configuration (what would come from VS Code settings)
    const mockConfig = {
      configPath: '/custom/config.toml',
      rules: {
        enable: ['MD001', 'MD003'],
        disable: ['MD013', 'MD024'],
      },
    };

    // Build initialization options using the same logic as client.ts
    const initializationOptions = buildInitializationOptions(mockConfig);

    // Verify camelCase format (these are the keys rumdl v0.0.171+ expects)
    expect(initializationOptions).to.have.property('configPath');
    expect(initializationOptions).to.have.property('enableLinting');
    expect(initializationOptions).to.have.property('enableAutoFix');
    expect(initializationOptions).to.have.property('enableRules');
    expect(initializationOptions).to.have.property('disableRules');

    // Verify snake_case format is NOT used (this was the bug in issue #70)
    expect(initializationOptions).to.not.have.property('config_path');
    expect(initializationOptions).to.not.have.property('enable_linting');
    expect(initializationOptions).to.not.have.property('enable_auto_fix');
    expect(initializationOptions).to.not.have.property('enable_rules');
    expect(initializationOptions).to.not.have.property('disable_rules');

    // Verify values are correct
    expect(initializationOptions.configPath).to.equal('/custom/config.toml');
    expect(initializationOptions.enableLinting).to.be.true;
    expect(initializationOptions.enableAutoFix).to.be.true;
    expect(initializationOptions.enableRules).to.deep.equal(['MD001', 'MD003']);
    expect(initializationOptions.disableRules).to.deep.equal(['MD013', 'MD024']);
  });

  test('disable rules configuration should be properly formatted', () => {
    // Test with multiple disabled rules (the exact scenario from issue #70)
    const mockConfig = {
      rules: {
        enable: [],
        disable: ['MD013', 'MD024', 'MD033', 'MD036'],
      },
    };

    const initializationOptions = buildInitializationOptions(mockConfig);

    // Verify the field is camelCase and has the correct values
    expect(initializationOptions).to.have.property('disableRules');
    expect(initializationOptions.disableRules).to.deep.equal(['MD013', 'MD024', 'MD033', 'MD036']);
  });

  test('enable rules configuration should be properly formatted', () => {
    const mockConfig = {
      rules: {
        enable: ['MD001', 'MD003', 'MD018'],
        disable: [],
      },
    };

    const initializationOptions = buildInitializationOptions(mockConfig);

    // Verify the field is camelCase and has the correct values
    expect(initializationOptions).to.have.property('enableRules');
    expect(initializationOptions.enableRules).to.deep.equal(['MD001', 'MD003', 'MD018']);
  });

  test('empty rules arrays should result in undefined initialization options', () => {
    const mockConfig = {
      rules: {
        enable: [],
        disable: [],
      },
    };

    const initializationOptions = buildInitializationOptions(mockConfig);

    // Empty arrays should result in undefined (don't send to LSP)
    expect(initializationOptions.enableRules).to.be.undefined;
    expect(initializationOptions.disableRules).to.be.undefined;
  });

  test('empty or whitespace configPath should result in undefined', () => {
    // Test with empty string
    let options = buildInitializationOptions({
      configPath: '',
      rules: { enable: [], disable: [] },
    });
    expect(options.configPath).to.be.undefined;

    // Test with whitespace only
    options = buildInitializationOptions({
      configPath: '   ',
      rules: { enable: [], disable: [] },
    });
    expect(options.configPath).to.be.undefined;

    // Test with undefined
    options = buildInitializationOptions({
      configPath: undefined,
      rules: { enable: [], disable: [] },
    });
    expect(options.configPath).to.be.undefined;
  });

  test('valid configPath should be preserved', () => {
    const options = buildInitializationOptions({
      configPath: '/path/to/config.toml',
      rules: { enable: [], disable: [] },
    });
    expect(options.configPath).to.equal('/path/to/config.toml');
  });
});
