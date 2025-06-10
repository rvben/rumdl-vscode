import * as vscode from 'vscode';
import { Logger } from './utils';

export enum ServerStatus {
  Starting = 'starting',
  Connected = 'connected',
  Disconnected = 'disconnected',
  Error = 'error',
}

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private currentStatus: ServerStatus = ServerStatus.Disconnected;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'rumdl.showClientLogs';
    this.updateStatusBar();
  }

  public setStatus(status: ServerStatus, message?: string): void {
    this.currentStatus = status;
    this.updateStatusBar(message);
    Logger.info(`Status changed to: ${status}${message ? ` - ${message}` : ''}`);
  }

  public setStarting(): void {
    this.setStatus(ServerStatus.Starting, 'Starting rumdl server...');
  }

  public setConnected(ruleCount?: number): void {
    const message = ruleCount ? `${ruleCount} rules active` : 'Connected';
    this.setStatus(ServerStatus.Connected, message);
  }

  public setDisconnected(reason?: string): void {
    this.setStatus(ServerStatus.Disconnected, reason || 'Disconnected');
  }

  public setError(error: string): void {
    this.setStatus(ServerStatus.Error, error);
  }

  private updateStatusBar(message?: string): void {
    switch (this.currentStatus) {
      case ServerStatus.Starting:
        this.statusBarItem.text = '$(loading~spin) rumdl';
        this.statusBarItem.tooltip = message || 'rumdl server is starting...';
        this.statusBarItem.backgroundColor = undefined;
        break;

      case ServerStatus.Connected:
        this.statusBarItem.text = '$(check) rumdl';
        this.statusBarItem.tooltip = message || 'rumdl server is running';
        this.statusBarItem.backgroundColor = undefined;
        break;

      case ServerStatus.Disconnected:
        this.statusBarItem.text = '$(circle-slash) rumdl';
        this.statusBarItem.tooltip = message || 'rumdl server is not running';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
        break;

      case ServerStatus.Error:
        this.statusBarItem.text = '$(error) rumdl';
        this.statusBarItem.tooltip = message || 'rumdl server error';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
    }
  }

  public show(): void {
    this.statusBarItem.show();
  }

  public hide(): void {
    this.statusBarItem.hide();
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
