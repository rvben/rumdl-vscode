import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Regression test for issue #118: "Format Document With..." shows two identical entries.
 *
 * The rumdl LSP server already advertises `documentFormattingProvider` as a server
 * capability, and `vscode-languageclient` auto-registers a `DocumentFormattingEditProvider`
 * when the server reports that capability. A second, client-side registration in this
 * extension causes a duplicate entry in the "Format Document With..." picker because
 * both surface under the same extension display name.
 *
 * The fix removes `src/formatter.ts` and the corresponding wiring in `src/extension.ts`.
 * These tests assert those invariants structurally so reintroducing the duplicate is
 * caught immediately. A runtime spy on `vscode.languages.registerDocumentFormattingEditProvider`
 * is unreliable here because the LSP path's auto-registration is async and races with
 * the test setup.
 */
suite('Formatter Registration Regression (issue #118)', () => {
  // Tests run from out/test/suite/, so the source tree is three levels up.
  const repoRoot = path.resolve(__dirname, '../../..');
  const srcDir = path.join(repoRoot, 'src');

  test('src/formatter.ts must not exist', () => {
    const formatterPath = path.join(srcDir, 'formatter.ts');
    assert.strictEqual(
      fs.existsSync(formatterPath),
      false,
      `${formatterPath} must not exist. Formatting is provided exclusively by the rumdl ` +
        `LSP server's documentFormattingProvider capability; a client-side formatter ` +
        `produces a duplicate entry in "Format Document With...".`
    );
  });

  test('src/extension.ts must not wire a client-side formatter', () => {
    const extensionPath = path.join(srcDir, 'extension.ts');
    const contents = fs.readFileSync(extensionPath, 'utf8');

    assert.doesNotMatch(
      contents,
      /from\s+['"]\.\/formatter['"]/,
      'src/extension.ts must not import from ./formatter; the module is intentionally absent.'
    );
    assert.doesNotMatch(
      contents,
      /\bregisterFormattingProvider\b/,
      'src/extension.ts must not call registerFormattingProvider; the LSP server registers ' +
        'the formatter via documentFormattingProvider capability.'
    );
    assert.doesNotMatch(
      contents,
      /\bRumdlFormattingProvider\b/,
      'src/extension.ts must not reference RumdlFormattingProvider; the class was removed.'
    );
  });

  test('no production source registers a client-side document formatter', () => {
    // Walk src/, excluding the test tree, and ensure none of the production .ts files
    // call vscode.languages.registerDocumentFormattingEditProvider directly.
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'test') {
            continue;
          }
          walk(full);
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.ts')) {
          continue;
        }
        const contents = fs.readFileSync(full, 'utf8');
        if (/registerDocumentFormattingEditProvider\s*\(/.test(contents)) {
          offenders.push(path.relative(repoRoot, full));
        }
      }
    };

    walk(srcDir);

    assert.deepStrictEqual(
      offenders,
      [],
      `These production files call vscode.languages.registerDocumentFormattingEditProvider ` +
        `directly: ${offenders.join(', ')}. Rely on the LSP server's documentFormattingProvider ` +
        `capability instead — see issue #118.`
    );
  });
});
