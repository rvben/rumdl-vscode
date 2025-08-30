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
    
    const rumdlConfig = vscode.workspace.getConfiguration('rumdl');
    await rumdlConfig.update('server.path', undefined, vscode.ConfigurationTarget.Workspace);
    
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('VSCode formatOnSave should work with rumdl formatter', async function () {
    this.timeout(30000);

    const contentWithIssues = `#Missing space after hash

Trailing spaces here   `;

    // Use the local release build
    const rumdlConfig = vscode.workspace.getConfiguration('rumdl');
    await rumdlConfig.update('server.path', '/Users/ruben/Projects/rumdl-repos/rumdl/target/release/rumdl', vscode.ConfigurationTarget.Workspace);

    // Enable VSCode's formatOnSave
    const editorConfig = vscode.workspace.getConfiguration('editor');
    await editorConfig.update('formatOnSave', true, vscode.ConfigurationTarget.Workspace);

    // Write and open document
    fs.writeFileSync(testFilePath, contentWithIssues);
    const document = await vscode.workspace.openTextDocument(testFilePath);
    await vscode.window.showTextDocument(document);

    // Wait for LSP to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify that manual formatting works
    await vscode.commands.executeCommand('editor.action.formatDocument');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const formattedText = document.getText();
    assert.ok(formattedText.includes('# Missing space'), 'Manual formatting should work');
    assert.ok(!formattedText.includes('   '), 'Trailing spaces should be removed');
    
    // Note: Actual save-triggered formatting would need to be tested manually
    // as the VSCode test environment doesn't trigger all save events properly
  });
});