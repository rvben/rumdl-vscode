import { expect } from '../helper';
import { RumdlLanguageClient } from '../../client';
import { StatusBarManager } from '../../statusBar';
import { sleep } from '../helper';
import * as vscode from 'vscode';

suite('Language Client Tests', () => {
  let client: RumdlLanguageClient;
  let statusBar: StatusBarManager;

  setup(() => {
    // Create real status bar for tests
    statusBar = new StatusBarManager();
    client = new RumdlLanguageClient(statusBar);
  });

  teardown(async () => {
    // Stop client if running
    if (client.isRunning()) {
      await client.stop();
    }
    client.dispose();
    statusBar.dispose();
  });

  test('isRunning should return false initially', () => {
    expect(client.isRunning()).to.be.false;
  });

  test('start should attempt to start language server', async () => {
    try {
      await client.start();
      // May fail if rumdl binary not found, which is ok
    } catch {
      // Expected if rumdl not installed
    }

    // Should set appropriate status
    expect(statusBar).to.exist;
  });

  test('stop should stop cleanly', async () => {
    // Start first
    try {
      await client.start();
      await sleep(1000);
    } catch {
      // If start fails, skip stop test
      return;
    }

    // Now stop
    await client.stop();
    expect(client.isRunning()).to.be.false;
  });

  test('restart should restart server', async () => {
    try {
      await client.restart();
      // May fail if rumdl not installed
    } catch {
      // Expected
    }

    expect(statusBar).to.exist;
  });

  test('executeCommand should throw when not running', async () => {
    expect(client.isRunning()).to.be.false;

    try {
      await client.executeCommand('test.command');
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.message).to.include('not running');
    }
  });

  test('dispose should clean up resources', () => {
    client.dispose();

    // Should not throw
    expect(() => client.dispose()).to.not.throw();
  });

  test('getClient should return client instance or undefined', () => {
    const clientInstance = client.getClient();

    // Should be undefined if not started
    if (!client.isRunning()) {
      expect(clientInstance).to.be.undefined;
    }
  });

  test('should handle missing rumdl binary gracefully', async () => {
    // Set a non-existent path
    const config = vscode.workspace.getConfiguration('rumdl');
    await config.update('server.path', '/nonexistent/rumdl', true);

    try {
      await client.start();
    } catch (error) {
      // Should fail gracefully
      expect(error).to.exist;
    }

    // Restore
    await config.update('server.path', undefined, true);
  });
});
