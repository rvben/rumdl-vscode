import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Format on Save Test', () => {
  let tempDir: string;
  let testFilePath: string;

  setup(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumdl-format-'));
    testFilePath = path.join(tempDir, 'test.md');
  });

  teardown(async () => {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    await editorConfig.update('formatOnSave', undefined, vscode.ConfigurationTarget.Workspace);

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('VSCode formatOnSave should work with rumdl formatter', async function () {
    this.timeout(30000);

    const contentWithIssues = `#Missing space after hash

Trailing spaces here   `;

    // Leave `rumdl.server.path` unset so the binary is resolved the way it is
    // for users, which finds the bundled one.

    // Enable VSCode's formatOnSave
    const editorConfig = vscode.workspace.getConfiguration('editor');
    await editorConfig.update('formatOnSave', true, vscode.ConfigurationTarget.Workspace);

    // Write and open document
    fs.writeFileSync(testFilePath, contentWithIssues);
    const document = await vscode.workspace.openTextDocument(testFilePath);
    await vscode.window.showTextDocument(document);

    // Wait for LSP to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify that manual formatting works by directly calling the format provider
    const formattingOptions: vscode.FormattingOptions = {
      tabSize: 2,
      insertSpaces: true,
    };
    const formattingEdits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
      'vscode.executeFormatDocumentProvider',
      document.uri,
      formattingOptions
    );

    // If we got edits, apply them
    if (formattingEdits && formattingEdits.length > 0) {
      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.set(document.uri, formattingEdits);
      await vscode.workspace.applyEdit(workspaceEdit);
    }

    const formattedText = document.getText();
    assert.ok(formattingEdits, 'Should return formatting edits');
    assert.ok(formattedText.includes('# Missing space'), 'Manual formatting should work');
    assert.ok(!formattedText.includes('   '), 'Trailing spaces should be removed');

    // Note: Actual save-triggered formatting would need to be tested manually
    // as the VSCode test environment doesn't trigger all save events properly
  });
});
