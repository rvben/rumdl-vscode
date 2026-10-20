import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  activateExtension,
  closeAllEditors,
  expect,
  getDocumentPath,
  getLanguageClient,
  sleep,
  waitForLanguageServer,
} from '../helper';

function linkDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(uri).filter(diagnostic => {
    const code = diagnostic.code;
    return (typeof code === 'object' && code !== null ? code.value : code) === 'MD057';
  });
}

async function waitForLinkDiagnostics(
  uri: vscode.Uri,
  predicate: (diagnostics: vscode.Diagnostic[]) => boolean
): Promise<void> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (predicate(linkDiagnostics(uri))) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`Unexpected MD057 diagnostics: ${JSON.stringify(linkDiagnostics(uri))}`);
}

suite('Link Diagnostic Refresh Integration Tests', () => {
  test('replaces a stale missing-link warning with compact-path diagnostics while typing', async function () {
    this.timeout(45000);
    const root = getDocumentPath(`issue-109-${process.pid}`);
    const filePath = path.join(root, 'ci', '_index.md');
    const configPath = path.join(root, '.rumdl.toml');
    const uri = vscode.Uri.file(filePath);
    const text = (target: string) => `# CI\n\n[CI/CD variables](${target})\n`;
    const config = vscode.workspace.getConfiguration('rumdl');
    const originalPath = config.inspect<string>('configPath')?.globalValue;
    const originalRun = config.inspect<string>('lint.run')?.globalValue;

    try {
      await fs.mkdir(path.join(root, 'ci', 'variables'), { recursive: true });
      await fs.writeFile(path.join(root, 'ci', 'variables', '_index.md'), '# Variables\n');
      await fs.writeFile(
        configPath,
        '[global]\nenable = ["MD057"]\n\n[MD057]\ncompact-paths = true\n'
      );
      await fs.writeFile(filePath, text('../ci/variables/_index.md'));
      await config.update('configPath', configPath, vscode.ConfigurationTarget.Global);
      await config.update('lint.run', 'onType', vscode.ConfigurationTarget.Global);
      await activateExtension();
      await sleep(1000);
      await waitForLanguageServer(15000);
      expect(getLanguageClient()?.isRunning()).to.equal(true);

      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
      const hasCompactWarning = (diagnostics: vscode.Diagnostic[]) =>
        diagnostics.length === 1 && diagnostics[0].message.includes('can be simplified');
      await waitForLinkDiagnostics(uri, hasCompactWarning);

      const changeTarget = async (target: string) => {
        const edit = new vscode.WorkspaceEdit();
        const content = document.getText();
        const from = content.indexOf('](') + 2;
        const to = content.indexOf(')', from);
        edit.replace(
          uri,
          new vscode.Range(document.positionAt(from), document.positionAt(to)),
          target
        );
        expect(await vscode.workspace.applyEdit(edit)).to.equal(true);
        expect(document.isDirty).to.equal(true);
      };
      await changeTarget('../civariables/_index.md');
      await waitForLinkDiagnostics(
        uri,
        diagnostics => diagnostics.length === 1 && diagnostics[0].message.includes('does not exist')
      );
      await changeTarget('../ci/variables/_index.md');
      await waitForLinkDiagnostics(uri, hasCompactWarning);
      await changeTarget('variables/_index.md');
      await waitForLinkDiagnostics(uri, diagnostics => diagnostics.length === 0);
    } finally {
      try {
        const document = vscode.workspace.textDocuments.find(
          document => document.uri.toString() === uri.toString()
        );
        if (document?.isDirty) {
          await document.save();
        }
        await closeAllEditors();
      } finally {
        await config.update('configPath', originalPath, vscode.ConfigurationTarget.Global);
        await config.update('lint.run', originalRun, vscode.ConfigurationTarget.Global);
        await fs.rm(root, { recursive: true, force: true });
      }
      await sleep(1000);
    }
  });
});
