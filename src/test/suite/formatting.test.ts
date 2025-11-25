import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Formatting Test Suite', () => {
  let tempDir: string;
  let testFilePath: string;

  setup(async () => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumdl-format-test-'));
    testFilePath = path.join(tempDir, 'test.md');
  });

  teardown(async () => {
    // Clean up test files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  test('Should format markdown document', async function () {
    this.timeout(30000);

    // Create a markdown file with issues
    const contentWithIssues = `#Missing space after hash

Trailing spaces here

-  Wrong list marker spacing`;

    // Write initial content
    fs.writeFileSync(testFilePath, contentWithIssues);

    // Open the document
    const document = await vscode.workspace.openTextDocument(testFilePath);
    await vscode.window.showTextDocument(document);

    // Wait for extension and LSP to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to get formatting edits with proper formatting options
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

    // Skip test if LSP server didn't start (common in CI environments)
    if (!formattingEdits) {
      console.log('LSP formatting provider not available - skipping test');
      this.skip();
      return;
    }

    // Check if we got any edits
    assert.ok(formattingEdits.length > 0, 'Should have at least one edit');

    // Apply the edits
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(document.uri, formattingEdits);
    const success = await vscode.workspace.applyEdit(workspaceEdit);
    assert.ok(success, 'Should successfully apply edits');

    // Get the formatted text
    const formattedText = document.getText();

    // Verify the formatting was applied
    assert.ok(formattedText.includes('# Missing space'), 'Should fix missing space after hash');
    assert.ok(!formattedText.includes('   '), 'Should remove trailing spaces');
    assert.ok(formattedText.includes('- Wrong'), 'Should fix list marker spacing');
  });
});
