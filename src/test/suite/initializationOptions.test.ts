import { expect } from '../helper';
import { buildInitializationOptions } from '../../client';
import { RumdlConfig } from '../../configuration';

/**
 * Tests for LSP initialization options format.
 * Regression test for issue #70 (config can't be read) and #116 (link toggles).
 *
 * These tests exercise the production transformation function exported from
 * client.ts — not a duplicated copy. Defaults for unset settings are applied
 * once, at the configuration boundary (ConfigurationManager.getConfiguration);
 * `buildInitializationOptions` operates on a fully-populated RumdlConfig.
 */

/**
 * Build a fully-populated RumdlConfig with sensible defaults, allowing tests
 * to override only the fields they care about.
 *
 * Mirrors the defaults declared in package.json contributes.configuration so
 * tests reflect the same baseline as a fresh user install.
 */
function makeConfig(overrides: Partial<RumdlConfig> = {}): RumdlConfig {
  return {
    enable: true,
    fixOnSave: false,
    configPath: undefined,
    rules: { enable: [], disable: [] },
    server: { path: undefined, logLevel: 'info' },
    trace: { server: 'off' },
    diagnostics: { deduplicate: true },
    linkCompletions: { enable: true },
    linkNavigation: { enable: true },
    ...overrides,
  };
}

suite('Initialization Options Tests', () => {
  test('initialization options use camelCase field names per LSP spec', () => {
    const options = buildInitializationOptions(
      makeConfig({
        configPath: '/custom/config.toml',
        fixOnSave: true,
        rules: {
          enable: ['MD001', 'MD003'],
          disable: ['MD013', 'MD024'],
        },
      })
    );

    // Verify camelCase format (rumdl v0.0.171+ requirement).
    expect(options).to.have.property('configPath');
    expect(options).to.have.property('enableLinting');
    expect(options).to.have.property('enableAutoFix');
    expect(options).to.have.property('enableRules');
    expect(options).to.have.property('disableRules');

    // Snake_case must NOT leak through (regression guard for issue #70).
    expect(options).to.not.have.property('config_path');
    expect(options).to.not.have.property('enable_linting');
    expect(options).to.not.have.property('enable_auto_fix');
    expect(options).to.not.have.property('enable_rules');
    expect(options).to.not.have.property('disable_rules');

    expect(options.configPath).to.equal('/custom/config.toml');
    expect(options.enableLinting).to.be.true;
    expect(options.enableAutoFix).to.be.true;
    expect(options.enableRules).to.deep.equal(['MD001', 'MD003']);
    expect(options.disableRules).to.deep.equal(['MD013', 'MD024']);
  });

  test('enableAutoFix is false by default (fixOnSave defaults to false)', () => {
    const options = buildInitializationOptions(makeConfig());
    expect(options.enableAutoFix).to.be.false;
  });

  test('enableAutoFix is true when fixOnSave is true', () => {
    const options = buildInitializationOptions(makeConfig({ fixOnSave: true }));
    expect(options.enableAutoFix).to.be.true;
  });

  test('enableAutoFix is false when fixOnSave is false', () => {
    const options = buildInitializationOptions(makeConfig({ fixOnSave: false }));
    expect(options.enableAutoFix).to.be.false;
  });

  test('disableRules carries the configured rule list verbatim', () => {
    const options = buildInitializationOptions(
      makeConfig({
        rules: { enable: [], disable: ['MD013', 'MD024', 'MD033', 'MD036'] },
      })
    );

    expect(options.disableRules).to.deep.equal(['MD013', 'MD024', 'MD033', 'MD036']);
  });

  test('enableRules carries the configured rule list verbatim', () => {
    const options = buildInitializationOptions(
      makeConfig({
        rules: { enable: ['MD001', 'MD003', 'MD018'], disable: [] },
      })
    );

    expect(options.enableRules).to.deep.equal(['MD001', 'MD003', 'MD018']);
  });

  test('empty rule arrays serialize as undefined (omitted from LSP message)', () => {
    const options = buildInitializationOptions(makeConfig());

    // undefined fields are stripped by the JSON-RPC layer, signaling "use server defaults".
    // Sending [] would override server defaults with an empty list — wrong semantics.
    expect(options.enableRules).to.be.undefined;
    expect(options.disableRules).to.be.undefined;
  });

  test('empty or whitespace configPath collapses to undefined', () => {
    expect(buildInitializationOptions(makeConfig({ configPath: '' })).configPath).to.be.undefined;
    expect(buildInitializationOptions(makeConfig({ configPath: '   ' })).configPath).to.be
      .undefined;
    expect(buildInitializationOptions(makeConfig({ configPath: undefined })).configPath).to.be
      .undefined;
  });

  test('valid configPath is preserved verbatim', () => {
    const options = buildInitializationOptions(makeConfig({ configPath: '/path/to/config.toml' }));
    expect(options.configPath).to.equal('/path/to/config.toml');
  });

  test('enableLinkCompletions defaults to true', () => {
    const options = buildInitializationOptions(makeConfig());
    expect(options.enableLinkCompletions).to.be.true;
  });

  test('enableLinkNavigation defaults to true', () => {
    const options = buildInitializationOptions(makeConfig());
    expect(options.enableLinkNavigation).to.be.true;
  });

  test('enableLinkCompletions reflects an explicit false override', () => {
    const options = buildInitializationOptions(makeConfig({ linkCompletions: { enable: false } }));
    expect(options.enableLinkCompletions).to.be.false;
  });

  test('enableLinkNavigation reflects an explicit false override', () => {
    const options = buildInitializationOptions(makeConfig({ linkNavigation: { enable: false } }));
    expect(options.enableLinkNavigation).to.be.false;
  });

  test('all fields are populated together correctly', () => {
    const options = buildInitializationOptions(
      makeConfig({
        configPath: '/project/config.toml',
        fixOnSave: true,
        rules: { enable: ['MD001'], disable: ['MD013'] },
        linkCompletions: { enable: true },
        linkNavigation: { enable: false },
      })
    );

    expect(options.configPath).to.equal('/project/config.toml');
    expect(options.enableLinting).to.be.true;
    expect(options.enableAutoFix).to.be.true;
    expect(options.enableRules).to.deep.equal(['MD001']);
    expect(options.disableRules).to.deep.equal(['MD013']);
    expect(options.enableLinkCompletions).to.be.true;
    expect(options.enableLinkNavigation).to.be.false;
  });
});
