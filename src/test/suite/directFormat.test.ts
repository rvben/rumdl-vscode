import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Direct Formatting Test', () => {
  let tempDir: string;
  let testFilePath: string;

  setup(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumdl-fmt-'));
    testFilePath = path.join(tempDir, 'test.md');
  });

  teardown(async () => {
    const config = vscode.workspace.getConfiguration('rumdl');
    await config.update('server.path', undefined, vscode.ConfigurationTarget.Workspace);

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('Format document directly via command', async function () {
    this.timeout(30000);

    const contentWithIssues = `#Missing space after hash

Trailing spaces here   `;

    // Use the local release build
    const config = vscode.workspace.getConfiguration('rumdl');
    await config.update(
      'server.path',
      '/Users/ruben/Projects/rumdl-repos/rumdl/target/release/rumdl',
      vscode.ConfigurationTarget.Workspace
    );

    // Write and open document
    fs.writeFileSync(testFilePath, contentWithIssues);
    const document = await vscode.workspace.openTextDocument(testFilePath);
    const editor = await vscode.window.showTextDocument(document);

    // Wait for LSP to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Execute format document command by directly calling the format provider
    const formattingOptions: vscode.FormattingOptions = {
      tabSize: 2,
      insertSpaces: true,
    };
    const formattingEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
      'vscode.executeFormatDocumentProvider',
      document.uri,
      formattingOptions
    );

    console.log('Formatting edits:', formattingEdits);

    // If we got edits, apply them
    if (formattingEdits && formattingEdits.length > 0) {
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.set(document.uri, formattingEdits);
      await vscode.workspace.applyEdit(workspaceEdit);
    }

    // Check the document content in the editor
    const formattedText = editor.document.getText();
    console.log('Formatted text:', JSON.stringify(formattedText));

    assert.ok(formattingEdits, 'Should return formatting edits');
    assert.ok(formattedText.includes('# Missing space'), 'Should have space after hash');
    assert.ok(!formattedText.includes('   '), 'Should not have trailing spaces');
  });
});
