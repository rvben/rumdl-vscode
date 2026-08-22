import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { expect } from '../helper';
import { activateExtension, openDocument, sleep, closeAllEditors } from '../helper';
import { findRumdlFixAllAction, RUMDL_FIX_ALL_KIND } from '../../commands';

suite('Commands Tests', () => {
  suiteSetup(async () => {
    await activateExtension();
    await sleep(2000);
  });

  teardown(async () => {
    await closeAllEditors();
  });

  test('selects only the namespaced rumdl fix-all action', () => {
    const generic = new vscode.CodeAction('Generic fix all', vscode.CodeActionKind.SourceFixAll);
    const rumdl = new vscode.CodeAction('Fix all rumdl issues', RUMDL_FIX_ALL_KIND);

    expect(findRumdlFixAllAction([generic, rumdl])).to.equal(rumdl);
    expect(findRumdlFixAllAction([generic])).to.be.undefined;
  });

  test('fixAll command applies the server namespaced action', async function () {
    this.timeout(20000);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumdl-fix-all-'));
    const filePath = path.join(tempDir, 'fix-all.md');
    fs.writeFileSync(filePath, '#Missing heading space   \n');

    try {
      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);

      let actionAvailable = false;
      for (let attempt = 0; attempt < 30 && !actionAvailable; attempt++) {
        const range = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
        const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          'vscode.executeCodeActionProvider',
          doc.uri,
          range,
          RUMDL_FIX_ALL_KIND.value
        );
        actionAvailable = findRumdlFixAllAction(actions) !== undefined;
        if (!actionAvailable) {
          await sleep(100);
        }
      }

      expect(actionAvailable, 'rumdl fix-all action should become available').to.be.true;
      await vscode.commands.executeCommand('rumdl.fixAll');

      expect(doc.getText()).to.equal('#Missing heading space\n');
    } finally {
      await closeAllEditors();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('fixAllWorkspace command is registered without mutating the test workspace', async () => {
    const commands = await vscode.commands.getCommands();
    expect(commands).to.include('rumdl.fixAllWorkspace');
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
