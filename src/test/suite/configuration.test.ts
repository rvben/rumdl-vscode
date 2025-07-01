import * as vscode from 'vscode';
import { expect } from '../helper';
import { ConfigurationManager } from '../../configuration';

suite('Configuration Tests', () => {
  let originalConfig: any = {};

  setup(() => {
    // Save original configuration
    const config = vscode.workspace.getConfiguration('rumdl');
    originalConfig = {
      enable: config.get('enable'),
      configPath: config.get('configPath'),
      rules: config.get('rules'),
      server: config.get('server'),
      // These are nested configurations, not direct ones
      // trace: config.get('trace.server'),
      // diagnostics: config.get('diagnostics.deduplicate'),
    };
  });

  teardown(async () => {
    // Restore original configuration
    const config = vscode.workspace.getConfiguration('rumdl');

    // Only restore settings that actually exist in the configuration
    if (originalConfig.enable !== undefined) {
      await config.update('enable', originalConfig.enable, vscode.ConfigurationTarget.Global);
    }
    if (originalConfig.configPath !== undefined) {
      await config.update(
        'configPath',
        originalConfig.configPath,
        vscode.ConfigurationTarget.Global
      );
    }
    // Note: server settings need to be updated individually
    if (originalConfig.server !== undefined) {
      if (originalConfig.server.path !== undefined) {
        await config.update(
          'server.path',
          originalConfig.server.path,
          vscode.ConfigurationTarget.Global
        );
      }
      if (originalConfig.server.logLevel !== undefined) {
        await config.update(
          'server.logLevel',
          originalConfig.server.logLevel,
          vscode.ConfigurationTarget.Global
        );
      }
    }
    // Note: trace and diagnostics are nested configurations, not direct ones
    // Skip restoring them as they're not valid configuration paths
  });

  test('getConfiguration should return default values', () => {
    const config = ConfigurationManager.getConfiguration();

    expect(config).to.have.property('enable');
    expect(config).to.have.property('server');
    expect(config).to.have.property('rules');
    expect(config).to.have.property('diagnostics');
    expect(config.server.path).to.be.a('string');
    expect(config.server.logLevel).to.be.a('string');
  });

  test('isEnabled should return boolean', () => {
    const enabled = ConfigurationManager.isEnabled();
    expect(enabled).to.be.a('boolean');
  });

  test('getRumdlPath should return string path', () => {
    const path = ConfigurationManager.getRumdlPath();
    expect(path).to.be.a('string');
    expect(path.length).to.be.greaterThan(0);
  });

  test('getRumdlPath should handle custom paths', async () => {
    const config = vscode.workspace.getConfiguration('rumdl');
    await config.update('server.path', '/custom/path/rumdl', true);

    const path = ConfigurationManager.getRumdlPath();
    expect(path).to.equal('/custom/path/rumdl');
  });

  test('getRumdlPath should handle empty path', async () => {
    const config = vscode.workspace.getConfiguration('rumdl');
    await config.update('server.path', '', true);

    const path = ConfigurationManager.getRumdlPath();
    expect(path).to.equal('rumdl'); // Should fall back to default
  });

  test('getLogLevel should return valid log level', () => {
    const level = ConfigurationManager.getLogLevel();
    expect(['trace', 'debug', 'info', 'warn', 'error']).to.include(level);
  });

  test('getTraceLevel should return valid trace level', () => {
    const level = ConfigurationManager.getTraceLevel();
    expect(['off', 'messages', 'verbose']).to.include(level);
  });

  test('shouldDeduplicate should return boolean', () => {
    const dedupe = ConfigurationManager.shouldDeduplicate();
    expect(dedupe).to.be.a('boolean');
  });

  test('onConfigurationChanged should fire on config changes', async function () {
    this.timeout(5000);

    // Use a promise to wait for the event
    const configChanged = new Promise<void>(resolve => {
      const disposable = ConfigurationManager.onConfigurationChanged(newConfig => {
        expect(newConfig).to.have.property('enable');
        expect(newConfig.server.logLevel).to.equal('debug');
        disposable.dispose();
        resolve();
      });
    });

    // Trigger a configuration change (change something other than enable to avoid server restart)
    const config = vscode.workspace.getConfiguration('rumdl');
    await config.update('server.logLevel', 'debug', vscode.ConfigurationTarget.Global);

    // Wait for the event to fire
    await configChanged;

    // Restore original value
    await config.update('server.logLevel', 'info', vscode.ConfigurationTarget.Global);
  });
});
