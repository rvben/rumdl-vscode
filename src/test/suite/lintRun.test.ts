import { expect } from '../helper';
import { buildDiagnosticPullOptions } from '../../client';
import { RumdlConfig } from '../../configuration';

/**
 * Tests for the diagnostic pull schedule `rumdl.lint.run` selects.
 *
 * These call the production mapping the language client is configured with,
 * so the schedule is covered without launching a server.
 */

function makeConfig(run: 'onType' | 'onSave'): RumdlConfig {
  return {
    enable: true,
    fixOnSave: false,
    lint: { run },
    configPath: undefined,
    rules: { enable: [], disable: [] },
    server: { path: undefined, logLevel: 'info' },
    trace: { server: 'off' },
    diagnostics: { deduplicate: true },
    linkCompletions: { enable: true, contentRoots: [] },
    linkNavigation: { enable: true },
  };
}

suite('Diagnostic Pull Schedule Tests', () => {
  test('onType pulls on change, matching the language client default', () => {
    expect(buildDiagnosticPullOptions(makeConfig('onType'))).to.deep.equal({
      onChange: true,
      onSave: false,
    });
  });

  test('onSave pulls only on save, so typing no longer re-lints', () => {
    expect(buildDiagnosticPullOptions(makeConfig('onSave'))).to.deep.equal({
      onChange: false,
      onSave: true,
    });
  });
});
