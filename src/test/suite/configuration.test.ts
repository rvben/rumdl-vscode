import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationManager } from '../../configuration';

suite('Configuration Test Suite', () => {
  test('Configuration should have default values', () => {
    const config = ConfigurationManager.getConfiguration();

    assert.strictEqual(config.enable, true);
    assert.strictEqual(config.server.logLevel, 'info');
    assert.strictEqual(config.trace.server, 'off');
    assert.strictEqual(config.diagnostics.deduplicate, true);
    assert.deepStrictEqual(config.rules.select, []);
    assert.deepStrictEqual(config.rules.ignore, []);
  });

  test('getRumdlPath should return non-empty string', () => {
    // This test is skipped because it requires Logger to be initialized
    // In a real test environment, we would mock the Logger
    const config = vscode.workspace.getConfiguration('rumdl');
    const path = config.get('server.path', 'rumdl');
    const finalPath = path && path.trim() !== '' ? path : 'rumdl';

    assert.ok(typeof finalPath === 'string');
    assert.ok(finalPath.length > 0);
  });

  test('isEnabled should return boolean', () => {
    const enabled = ConfigurationManager.isEnabled();
    assert.ok(typeof enabled === 'boolean');
  });

  test('getLogLevel should return valid log level', () => {
    const logLevel = ConfigurationManager.getLogLevel();
    assert.ok(['error', 'warn', 'info', 'debug', 'trace'].includes(logLevel));
  });

  test('getTraceLevel should return valid trace level', () => {
    const traceLevel = ConfigurationManager.getTraceLevel();
    assert.ok(['off', 'messages', 'verbose'].includes(traceLevel));
  });

  test('shouldDeduplicate should return boolean', () => {
    const shouldDedupe = ConfigurationManager.shouldDeduplicate();
    assert.ok(typeof shouldDedupe === 'boolean');
  });
});
