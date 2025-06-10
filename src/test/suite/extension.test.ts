import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests for rumdl extension.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('rvben.rumdl'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('rvben.rumdl')!;
    await extension.activate();
    assert.strictEqual(extension.isActive, true);
  });

  test('Extension should activate on markdown files', async () => {
    // Create a markdown document
    const document = await vscode.workspace.openTextDocument({
      content: '# Test Markdown\n\nThis is a test.',
      language: 'markdown',
    });

    await vscode.window.showTextDocument(document);

    // Extension should be active after opening markdown file
    const extension = vscode.extensions.getExtension('rvben.rumdl')!;
    assert.strictEqual(extension.isActive, true);
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);

    // Check that our main commands are registered
    assert.ok(commands.includes('rumdl.fixAll'));
    assert.ok(commands.includes('rumdl.restartServer'));
    assert.ok(commands.includes('rumdl.showClientLogs'));
    assert.ok(commands.includes('rumdl.showServerLogs'));
  });
});
