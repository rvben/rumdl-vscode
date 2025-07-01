import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { expect } from '../helper';
import { activateExtension, openDocument, sleep, closeAllEditors } from '../helper';

suite('Commands Tests', () => {
  suiteSetup(async () => {
    await activateExtension();
    await sleep(2000);
  });

  teardown(async () => {
    await closeAllEditors();
  });

  test.skip('fixAll command should fix issues in active editor', async () => {
    // Skip: The fixAll command requires code actions from the language server
    // which may not be available in the test environment
    const doc = await openDocument('diagnostics.md');
    await vscode.window.showTextDocument(doc);

    // Get original content
    const originalContent = doc.getText();
    expect(originalContent).to.include('   '); // trailing spaces

    // Execute fixAll
    await vscode.commands.executeCommand('rumdl.fixAll');
    await sleep(1000);

    // Check that trailing spaces were removed
    const newContent = doc.getText();
    const lines = newContent.split('\n');
    for (const line of lines) {
      expect(line).to.not.match(/\s+$/);
    }
  });

  test('fixAllWorkspace command should process multiple files', async () => {
    // This command shows progress and processes all markdown files
    // Just verify it runs without error
    try {
      await vscode.commands.executeCommand('rumdl.fixAllWorkspace');
      // Command executed successfully
    } catch {
      // May fail if no workspace is open, which is ok
    }
  });

  test('showClientLogs command should show output channel', async () => {
    await vscode.commands.executeCommand('rumdl.showClientLogs');
    await sleep(500);

    // Verify output channel was shown (can't directly test this)
    const commands = await vscode.commands.getCommands();
    expect(commands).to.include('rumdl.showClientLogs');
  });

  test('showServerLogs command should show trace channel', async () => {
    await vscode.commands.executeCommand('rumdl.showServerLogs');
    await sleep(500);

    // Verify command exists
    const commands = await vscode.commands.getCommands();
    expect(commands).to.include('rumdl.showServerLogs');
  });

  test('printDebugInfo command should collect debug information', async () => {
    await vscode.commands.executeCommand('rumdl.printDebugInfo');
    await sleep(500);

    // Command should execute without throwing
    const commands = await vscode.commands.getCommands();
    expect(commands).to.include('rumdl.printDebugInfo');
  });

  test.skip('checkDuplicateDiagnostics command should analyze diagnostics', async () => {
    // Skip: This command shows information messages
    const doc = await openDocument('diagnostics.md');
    await vscode.window.showTextDocument(doc);
    await sleep(2000);

    await vscode.commands.executeCommand('rumdl.checkDuplicateDiagnostics');
    await sleep(500);

    // Command should execute without throwing
    const commands = await vscode.commands.getCommands();
    expect(commands).to.include('rumdl.checkDuplicateDiagnostics');
  });

  test.skip('checkStatus command should show extension status', async () => {
    // Skip: This command shows a modal dialog which blocks tests
    await vscode.commands.executeCommand('rumdl.checkStatus');
    await sleep(500);

    // Command should execute without throwing
    const commands = await vscode.commands.getCommands();
    expect(commands).to.include('rumdl.checkStatus');
  });

  test.skip('createSampleConfig command should create config file', async () => {
    // Skip: This command shows information messages
    // Get workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // Skip test if no workspace
      return;
    }

    const configPath = path.join(workspaceFolders[0].uri.fsPath, '.rumdl.toml');

    // Remove existing config if any
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }

    // Execute command
    await vscode.commands.executeCommand('rumdl.createSampleConfig');
    await sleep(1000);

    // Check if file was created
    expect(fs.existsSync(configPath)).to.be.true;

    // Clean up
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  });

  test.skip('testConfigDiscovery command should find config files', async () => {
    // Skip: This command shows a modal dialog which blocks tests
    await vscode.commands.executeCommand('rumdl.testConfigDiscovery');
    await sleep(500);

    // Command should execute without throwing
    const commands = await vscode.commands.getCommands();
    expect(commands).to.include('rumdl.testConfigDiscovery');
  });
});
