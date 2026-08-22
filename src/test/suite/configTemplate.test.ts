import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { DEFAULT_CONFIG_CONTENT } from '../../commands';
import { ConfigValidator } from '../../configValidator';

function findBundledRumdl(): string | undefined {
  const binary =
    process.platform === 'win32'
      ? 'rumdl-x86_64-pc-windows-msvc.exe'
      : process.platform === 'darwin'
        ? process.arch === 'arm64'
          ? 'rumdl-aarch64-apple-darwin'
          : 'rumdl-x86_64-apple-darwin'
        : process.arch === 'arm64'
          ? 'rumdl-aarch64-unknown-linux-musl'
          : 'rumdl-x86_64-unknown-linux-musl';
  const candidate = path.resolve(__dirname, '../../../bundled-tools', binary);
  return fs.existsSync(candidate) ? candidate : undefined;
}

suite('Generated Configuration Template', () => {
  test('uses the current rumdl configuration dialect', () => {
    assert.match(DEFAULT_CONFIG_CONTENT, /^\[global\]$/m);
    assert.match(DEFAULT_CONFIG_CONTENT, /^enable = \[\]$/m);
    assert.match(DEFAULT_CONFIG_CONTENT, /^disable = \[\]$/m);
    assert.match(DEFAULT_CONFIG_CONTENT, /^\[MD013\]$/m);
    assert.doesNotMatch(DEFAULT_CONFIG_CONTENT, /^\[rules\]$/m);
    assert.doesNotMatch(DEFAULT_CONFIG_CONTENT, /^\[files\]$/m);
  });

  test('passes the extension configuration validator', () => {
    const result = ConfigValidator.validateToml(DEFAULT_CONFIG_CONTENT);
    assert.strictEqual(
      result.valid,
      true,
      `template diagnostics: ${result.errors.map(error => error.message).join('; ')}`
    );
    assert.deepStrictEqual(result.errors, []);
  });

  test('is accepted without warnings by the bundled rumdl CLI', function () {
    const rumdl = findBundledRumdl();
    if (!rumdl) {
      this.skip();
      return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumdl-config-template-'));
    const configPath = path.join(tempDir, '.rumdl.toml');
    try {
      fs.writeFileSync(configPath, DEFAULT_CONFIG_CONTENT);
      const result = spawnSync(rumdl, ['config', '--no-defaults', '--config', configPath], {
        encoding: 'utf8',
      });

      assert.strictEqual(result.status, 0, result.stderr || result.stdout);
      assert.doesNotMatch(result.stderr, /config warning|unknown rule/i);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
