import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import {
  activateExtension,
  closeAllEditors,
  expect,
  getDocumentPath,
  sleep,
  waitForLanguageServer,
} from '../helper';

function diagnosticCode(diagnostic: vscode.Diagnostic): string | number | undefined {
  const code = diagnostic.code;
  return typeof code === 'object' && code !== null ? code.value : code;
}

async function waitForDiagnosticCode(
  uri: vscode.Uri,
  code: string,
  timeout = 5000
): Promise<boolean> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (vscode.languages.getDiagnostics(uri).some(item => diagnosticCode(item) === code)) {
      return true;
    }
    await sleep(100);
  }
  return false;
}

suite('Lint Run Integration Tests', () => {
  test('onSave holds diagnostics when a Markdown link triggers a server refresh', async function () {
    this.timeout(30000);

    await activateExtension();
    const config = vscode.workspace.getConfiguration('rumdl');
    const originalRun = config.get<string>('lint.run');
    const fileName = `issue-193-${process.pid}.md`;
    const filePath = getDocumentPath(fileName);
    const uri = vscode.Uri.file(filePath);
    const initialText = `# Example (bad)\n\n[example](${fileName}) \n`;

    try {
      await config.update('lint.run', 'onSave', vscode.ConfigurationTarget.Global);
      // Configuration changes restart the language client asynchronously.
      await sleep(1000);
      await waitForLanguageServer(15000);

      await fs.writeFile(filePath, initialText);
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);

      // A saved warning proves the initial pull completed and was cached.
      expect(await waitForDiagnosticCode(uri, 'MD009', 10000)).to.equal(true);

      const edit = new vscode.WorkspaceEdit();
      edit.insert(uri, new vscode.Position(2, 0), '\n\n');
      expect(await vscode.workspace.applyEdit(edit)).to.equal(true);
      expect(document.isDirty).to.equal(true);

      // rumdl's cross-file index debounces for 100 ms before requesting a
      // workspace diagnostic refresh. Wait well beyond that and verify that
      // the unsaved MD012 finding is still held back.
      await sleep(750);
      const unsavedCodes = vscode.languages.getDiagnostics(uri).map(diagnosticCode);
      expect(unsavedCodes).to.include('MD009');
      expect(unsavedCodes).to.not.include('MD012');

      expect(await document.save()).to.equal(true);
      expect(await waitForDiagnosticCode(uri, 'MD012', 10000)).to.equal(true);
    } finally {
      await closeAllEditors();
      await fs.rm(filePath, { force: true });
      await config.update('lint.run', originalRun, vscode.ConfigurationTarget.Global);
      await sleep(1000);
    }
  });
});
