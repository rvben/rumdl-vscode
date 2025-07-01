// import * as vscode from 'vscode';
import { expect } from '../helper';
import { StatusBarManager, ServerStatus } from '../../statusBar';

suite('StatusBar Tests', () => {
  let statusBar: StatusBarManager;

  setup(() => {
    statusBar = new StatusBarManager();
  });

  teardown(() => {
    statusBar.dispose();
  });

  test('should set starting state', () => {
    statusBar.setStarting();

    // Can't directly access internal statusBarItem, just verify it doesn't throw
    expect(() => statusBar.setStarting()).to.not.throw();
  });

  test('should set connected state', () => {
    statusBar.setConnected();

    expect(() => statusBar.setConnected()).to.not.throw();
  });

  test('should set connected state with rule count', () => {
    statusBar.setConnected(5);

    expect(() => statusBar.setConnected(5)).to.not.throw();
  });

  test('should set disconnected state', () => {
    statusBar.setDisconnected();

    expect(() => statusBar.setDisconnected()).to.not.throw();
  });

  test('should set disconnected state with reason', () => {
    statusBar.setDisconnected('Server stopped');

    expect(() => statusBar.setDisconnected('Server stopped')).to.not.throw();
  });

  test('should set error state with message', () => {
    statusBar.setError('Test error');

    expect(() => statusBar.setError('Test error')).to.not.throw();
  });

  test('should set status with ServerStatus enum', () => {
    statusBar.setStatus(ServerStatus.Connected, 'Test message');

    expect(() => statusBar.setStatus(ServerStatus.Connected, 'Test message')).to.not.throw();
  });

  test('should handle all server status values', () => {
    const statuses = [
      ServerStatus.Starting,
      ServerStatus.Connected,
      ServerStatus.Disconnected,
      ServerStatus.Error,
    ];

    for (const status of statuses) {
      expect(() => statusBar.setStatus(status)).to.not.throw();
    }
  });

  test('should show and hide', () => {
    statusBar.show();
    statusBar.hide();

    expect(() => statusBar.show()).to.not.throw();
    expect(() => statusBar.hide()).to.not.throw();
  });

  test('should dispose without error', () => {
    expect(() => statusBar.dispose()).to.not.throw();

    // Should be safe to dispose multiple times
    expect(() => statusBar.dispose()).to.not.throw();
  });
});
