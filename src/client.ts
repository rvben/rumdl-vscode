import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  State,
  RevealOutputChannelOn
} from 'vscode-languageclient/node';
import { ConfigurationManager } from './configuration';
import { Logger, checkRumdlInstallation, getRumdlVersion, showErrorMessage } from './utils';
import { StatusBarManager, ServerStatus } from './statusBar';
import { BundledToolsManager } from './bundledTools';

export class RumdlLanguageClient implements vscode.Disposable {
  private client: LanguageClient | undefined;
  private statusBar: StatusBarManager;
  private restartCount = 0;
  private maxRestarts = 5;
  private isDisposed = false;

  constructor(statusBar: StatusBarManager) {
    this.statusBar = statusBar;
  }

  public async start(): Promise<void> {
    if (this.client) {
      Logger.warn('Client is already running');
      return;
    }

    try {
      Logger.info('Starting rumdl language client...');

      // Log bundled tools information
      BundledToolsManager.logBundledToolsInfo();

      const config = ConfigurationManager.getConfiguration();

      // Get the best available rumdl path (bundled first, then configured/system)
      const rumdlPath = await BundledToolsManager.getBestRumdlPath(config.server.path);

      // Check if rumdl is available
      const isInstalled = await checkRumdlInstallation(rumdlPath);
      if (!isInstalled) {
        const bundledAvailable = BundledToolsManager.hasBundledTools();
        const errorMessage = bundledAvailable
          ? `rumdl binary not working: ${rumdlPath}. Please check the bundled binary or install rumdl manually.`
          : `rumdl not found: ${rumdlPath}. Please install rumdl or configure the correct path in settings.`;

        Logger.error(errorMessage);
        this.statusBar.setError('rumdl not found');
        showErrorMessage(errorMessage);
        return;
      }

      // Get and log rumdl version
      const version = await getRumdlVersion(rumdlPath);
      if (version) {
        Logger.info(`Using rumdl version: ${version}`);
      }

      this.statusBar.setStarting();

      const serverOptions: ServerOptions = {
        command: rumdlPath,
        args: ['server', '--stdio'],
        options: {
          env: {
            ...process.env,
            RUST_LOG: config.server.logLevel
          }
        }
      };

      const clientOptions: LanguageClientOptions = {
        documentSelector: [
          { scheme: 'file', language: 'markdown' },
          { scheme: 'untitled', language: 'markdown' }
        ],
        synchronize: {
          fileEvents: [
            vscode.workspace.createFileSystemWatcher('**/.rumdl.toml'),
            vscode.workspace.createFileSystemWatcher('**/rumdl.toml'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.json'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.jsonc'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.yaml'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.yml')
          ]
        },
        outputChannelName: 'rumdl Language Server',
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        traceOutputChannel: ConfigurationManager.getTraceLevel() !== 'off' ? vscode.window.createOutputChannel('rumdl Language Server Trace') : undefined,
        diagnosticCollectionName: 'rumdl'
      };

      this.client = new LanguageClient(
        'rumdl',
        'rumdl Language Server',
        serverOptions,
        clientOptions
      );

      // Set up event handlers
      this.client.onDidChangeState((event) => {
        Logger.info(`Client state changed: ${State[event.oldState]} -> ${State[event.newState]}`);

        switch (event.newState) {
          case State.Starting:
            this.statusBar.setStarting();
            break;
          case State.Running:
            this.statusBar.setConnected();
            this.restartCount = 0; // Reset restart count on successful connection
            break;
          case State.Stopped:
            if (!this.isDisposed) {
              this.statusBar.setDisconnected();
              this.handleServerStop();
            }
            break;
        }
      });

      // Add diagnostic debugging and deduplication
      this.client.onNotification('textDocument/publishDiagnostics', (params) => {
        Logger.debug(`Received diagnostics for ${params.uri}: ${params.diagnostics.length} issues`);

        if (params.diagnostics.length > 0) {
          const duplicates = this.findDuplicateDiagnostics(params.diagnostics);
          if (duplicates.length > 0) {
            Logger.warn(`Found ${duplicates.length} duplicate diagnostics in server response`);

            // If deduplication is enabled, remove duplicates
            if (ConfigurationManager.shouldDeduplicate()) {
              const originalCount = params.diagnostics.length;
              params.diagnostics = this.deduplicateDiagnostics(params.diagnostics);
              Logger.info(`Deduplicated diagnostics: ${originalCount} -> ${params.diagnostics.length}`);
            }
          }
        }
      });

      // Start the client
      await this.client.start();
      Logger.info('rumdl language server started successfully');
    } catch (error) {
      Logger.error('Failed to start rumdl language server', error as Error);
      this.statusBar.setError('Failed to start');
      throw error;
    }
  }

  private async handleServerStop(): Promise<void> {
    if (this.isDisposed || this.restartCount >= this.maxRestarts) {
      if (this.restartCount >= this.maxRestarts) {
        Logger.error(`Server stopped after ${this.maxRestarts} restart attempts`);
        this.statusBar.setError('Too many restarts');
        showErrorMessage(
          'rumdl server has crashed multiple times. Please check the server logs for details.',
          'Show Logs'
        ).then(action => {
          if (action === 'Show Logs') {
            vscode.commands.executeCommand('rumdl.showServerLogs');
          }
        });
      }
      return;
    }

    this.restartCount++;
    Logger.warn(`Server stopped unexpectedly. Attempting restart ${this.restartCount}/${this.maxRestarts}`);

    // Wait before restarting (exponential backoff)
    const delay = Math.min(1000 * Math.pow(2, this.restartCount - 1), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.restart();
    } catch (error) {
      Logger.error('Failed to restart server', error as Error);
    }
  }

  public async restart(): Promise<void> {
    Logger.info('Restarting rumdl language server');

    if (this.client) {
      await this.stop();
    }

    await this.start();
  }

  public async stop(): Promise<void> {
    if (!this.client) {
      return;
    }

    Logger.info('Stopping rumdl language server');

    try {
      await this.client.stop();
    } catch (error) {
      Logger.error('Error stopping client', error as Error);
    } finally {
      this.client = undefined;
      if (!this.isDisposed) {
        this.statusBar.setDisconnected();
      }
    }
  }

  public isRunning(): boolean {
    return this.client?.state === State.Running;
  }

  public getClient(): LanguageClient | undefined {
    return this.client;
  }

  public async executeCommand(command: string, ...args: any[]): Promise<any> {
    if (!this.client || !this.isRunning()) {
      throw new Error('Language server is not running');
    }

    return this.client.sendRequest('workspace/executeCommand', {
      command,
      arguments: args
    });
  }

    private findDuplicateDiagnostics(diagnostics: any[]): any[] {
    const seen = new Set<string>();
    const duplicates: any[] = [];

    for (const diagnostic of diagnostics) {
      const key = `${diagnostic.range.start.line}:${diagnostic.range.start.character}-${diagnostic.range.end.line}:${diagnostic.range.end.character}:${diagnostic.message}:${diagnostic.code}`;

      if (seen.has(key)) {
        duplicates.push(diagnostic);
      } else {
        seen.add(key);
      }
    }

    return duplicates;
  }

  private deduplicateDiagnostics(diagnostics: any[]): any[] {
    const seen = new Set<string>();
    const unique: any[] = [];

    for (const diagnostic of diagnostics) {
      const key = `${diagnostic.range.start.line}:${diagnostic.range.start.character}-${diagnostic.range.end.line}:${diagnostic.range.end.character}:${diagnostic.message}:${diagnostic.code}`;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(diagnostic);
      }
    }

    return unique;
  }

  public dispose(): void {
    this.isDisposed = true;
    if (this.client) {
      this.client.stop();
      this.client = undefined;
    }
  }
}