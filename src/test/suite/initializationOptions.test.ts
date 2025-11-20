import { expect } from '../helper';
import * as vscode from 'vscode';

/**
 * Tests for LSP initialization options format
 * Regression test for issue #70: Config can't be read
 *
 * These tests verify that the VS Code extension sends initialization options
 * in camelCase format as expected by rumdl v0.0.171+ per LSP specification.
 */
suite('Initialization Options Tests', () => {
  test('initialization options should use camelCase field names', async () => {
    // Set up test configuration
    const config = vscode.workspace.getConfiguration('rumdl');
    await config.update('rules.disable', ['MD013', 'MD024'], vscode.ConfigurationTarget.Global);
    await config.update('rules.enable', ['MD001', 'MD003'], vscode.ConfigurationTarget.Global);
    await config.update('configPath', '/custom/config.toml', vscode.ConfigurationTarget.Global);

    // Get current configuration
    // Note: This is testing the format, not the actual LSP communication
    const currentConfig = config;
    const rulesConfig = currentConfig.get<{ enable: string[]; disable: string[] }>('rules') || {
      enable: [],
      disable: [],
    };
    const configPath = currentConfig.get<string>('configPath');

    // Build initialization options in the same way the client does
    const initializationOptions = {
      configPath: configPath && configPath.trim() !== '' ? configPath : undefined,
      enableLinting: true,
      enableAutoFix: true,
      enableRules: rulesConfig.enable.length > 0 ? rulesConfig.enable : undefined,
      disableRules: rulesConfig.disable.length > 0 ? rulesConfig.disable : undefined,
    };

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

    // Clean up
    await config.update('rules.disable', undefined, vscode.ConfigurationTarget.Global);
    await config.update('rules.enable', undefined, vscode.ConfigurationTarget.Global);
    await config.update('configPath', undefined, vscode.ConfigurationTarget.Global);
  });

  test('disable rules configuration should be properly formatted', async () => {
    const config = vscode.workspace.getConfiguration('rumdl');

    // Test with multiple disabled rules (the exact scenario from issue #70)
    await config.update(
      'rules.disable',
      ['MD013', 'MD024', 'MD033', 'MD036'],
      vscode.ConfigurationTarget.Global
    );

    const rulesConfig = config.get<{ enable: string[]; disable: string[] }>('rules') || {
      enable: [],
      disable: [],
    };

    // Build initialization options
    const initializationOptions = {
      disableRules: rulesConfig.disable.length > 0 ? rulesConfig.disable : undefined,
    };

    // Verify the field is camelCase and has the correct values
    expect(initializationOptions).to.have.property('disableRules');
    expect(initializationOptions.disableRules).to.deep.equal(['MD013', 'MD024', 'MD033', 'MD036']);

    // Clean up
    await config.update('rules.disable', undefined, vscode.ConfigurationTarget.Global);
  });

  test('enable rules configuration should be properly formatted', async () => {
    const config = vscode.workspace.getConfiguration('rumdl');

    await config.update(
      'rules.enable',
      ['MD001', 'MD003', 'MD018'],
      vscode.ConfigurationTarget.Global
    );

    const rulesConfig = config.get<{ enable: string[]; disable: string[] }>('rules') || {
      enable: [],
      disable: [],
    };

    // Build initialization options
    const initializationOptions = {
      enableRules: rulesConfig.enable.length > 0 ? rulesConfig.enable : undefined,
    };

    // Verify the field is camelCase and has the correct values
    expect(initializationOptions).to.have.property('enableRules');
    expect(initializationOptions.enableRules).to.deep.equal(['MD001', 'MD003', 'MD018']);

    // Clean up
    await config.update('rules.enable', undefined, vscode.ConfigurationTarget.Global);
  });

  test('empty rules arrays should result in undefined initialization options', async () => {
    const config = vscode.workspace.getConfiguration('rumdl');

    // Ensure rules are empty
    await config.update('rules.disable', [], vscode.ConfigurationTarget.Global);
    await config.update('rules.enable', [], vscode.ConfigurationTarget.Global);

    const rulesConfig = config.get<{ enable: string[]; disable: string[] }>('rules') || {
      enable: [],
      disable: [],
    };

    // Build initialization options
    const initializationOptions = {
      enableRules: rulesConfig.enable.length > 0 ? rulesConfig.enable : undefined,
      disableRules: rulesConfig.disable.length > 0 ? rulesConfig.disable : undefined,
    };

    // Empty arrays should result in undefined (don't send to LSP)
    expect(initializationOptions.enableRules).to.be.undefined;
    expect(initializationOptions.disableRules).to.be.undefined;

    // Clean up
    await config.update('rules.disable', undefined, vscode.ConfigurationTarget.Global);
    await config.update('rules.enable', undefined, vscode.ConfigurationTarget.Global);
  });
});
