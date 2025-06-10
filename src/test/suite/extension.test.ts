import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
  it('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('rvben.rumdl'));
  });

  it('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('rvben.rumdl');
    assert.ok(ext);
    await ext!.activate();
    assert.strictEqual(ext!.isActive, true);
  });

  it('Should register all commands', async () => {
    const ext = vscode.extensions.getExtension('rvben.rumdl');
    await ext!.activate();

    const commands = await vscode.commands.getCommands();
    const rumdlCommands = [
      'rumdl.fixAll',
      'rumdl.fixAllWorkspace',
      'rumdl.restartServer',
      'rumdl.showClientLogs',
      'rumdl.showServerLogs',
      'rumdl.printDebugInfo',
      'rumdl.checkDuplicateDiagnostics',
      'rumdl.checkStatus'
    ];

    for (const cmd of rumdlCommands) {
      assert.ok(
        commands.includes(cmd),
        `Command ${cmd} should be registered`
      );
    }
  });
});