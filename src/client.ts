import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  State,
  RevealOutputChannelOn,
} from 'vscode-languageclient/node';
import { ConfigurationManager } from './configuration';
import { Logger, checkRumdlInstallation, getRumdlVersion, showErrorMessage } from './utils';
import { StatusBarManager } from './statusBar';
import { BundledToolsManager } from './bundledTools';

export class RumdlLanguageClient implements vscode.Disposable {
  private client: LanguageClient | undefined;
  private statusBar: StatusBarManager;
  private restartCount = 0;
  private maxRestarts = 5;
  private isDisposed = false;
  private isManualRestart = false; // Flag to prevent automatic restart during manual restart

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

      // Determine working directory (workspace root or current directory)
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workingDirectory = workspaceFolder?.uri.fsPath || process.cwd();
      Logger.info(`Using working directory: ${workingDirectory}`);

      // Build server arguments (no config arguments, they go through initialization options)
      const serverArgs = ['server', '--stdio'];

      const serverOptions: ServerOptions = {
        command: rumdlPath,
        args: serverArgs,
        options: {
          cwd: workingDirectory,
          env: {
            ...process.env,
            RUST_LOG: config.server.logLevel,
          },
        },
      };

      // Build initialization options from VSCode settings
      const initializationOptions = {
        config_path: config.configPath && config.configPath.trim() !== '' ? config.configPath : undefined,
        enable_linting: true,
        enable_auto_fix: true, // Always enable auto-fix capability in LSP, autoFixOnSave controls when it's applied
        enable_rules: config.rules.enable.length > 0 ? config.rules.enable : undefined,
        disable_rules: config.rules.disable.length > 0 ? config.rules.disable : undefined,
      };

      const clientOptions: LanguageClientOptions = {
        documentSelector: [
          { scheme: 'file', language: 'markdown' },
          { scheme: 'untitled', language: 'markdown' },
        ],
        synchronize: {
          fileEvents: [
            vscode.workspace.createFileSystemWatcher('**/.rumdl.toml'),
            vscode.workspace.createFileSystemWatcher('**/rumdl.toml'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.json'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.jsonc'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.yaml'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.yml'),
          ],
        },
        outputChannelName: 'rumdl Language Server',
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        traceOutputChannel:
          ConfigurationManager.getTraceLevel() !== 'off'
            ? vscode.window.createOutputChannel('rumdl Language Server Trace')
            : undefined,
        diagnosticCollectionName: 'rumdl',
        initializationOptions,
      };

      this.client = new LanguageClient(
        'rumdl',
        'rumdl Language Server',
        serverOptions,
        clientOptions
      );

      // Set up event handlers
      this.client.onDidChangeState(event => {
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
      this.client.onNotification('textDocument/publishDiagnostics', params => {
        Logger.debug(`Received diagnostics for ${params.uri}: ${params.diagnostics.length} issues`);

        if (params.diagnostics.length > 0) {
          const duplicates = this.findDuplicateDiagnostics(params.diagnostics);
          if (duplicates.length > 0) {
            Logger.warn(`Found ${duplicates.length} duplicate diagnostics in server response`);

            // If deduplication is enabled, remove duplicates
            if (ConfigurationManager.shouldDeduplicate()) {
              const originalCount = params.diagnostics.length;
              params.diagnostics = this.deduplicateDiagnostics(params.diagnostics);
              Logger.info(
                `Deduplicated diagnostics: ${originalCount} -> ${params.diagnostics.length}`
              );
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
    // Don't auto-restart during manual restart or if disposed
    if (this.isDisposed || this.isManualRestart || this.restartCount >= this.maxRestarts) {
      if (this.restartCount >= this.maxRestarts && !this.isManualRestart) {
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
    Logger.warn(
      `Server stopped unexpectedly. Attempting restart ${this.restartCount}/${this.maxRestarts}`
    );

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

    try {
      this.isManualRestart = true; // Set flag to prevent auto-restart during manual restart

      if (this.client) {
        await this.stop();
      }

      await this.start();
      Logger.info('rumdl language server restarted successfully');
    } catch (error) {
      Logger.error('Failed to restart rumdl language server', error as Error);
      this.statusBar.setError('Restart failed');
      throw error;
    } finally {
      this.isManualRestart = false; // Clear flag after restart attempt
    }
  }

  public async stop(): Promise<void> {
    if (!this.client) {
      return;
    }

    Logger.info('Stopping rumdl language server');

    const client = this.client;
    this.client = undefined; // Clear reference immediately to prevent multiple stops

    try {
      // Stop the client with a timeout to prevent hanging
      const stopPromise = client.stop();
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Stop timeout')), 5000);
      });

      await Promise.race([stopPromise, timeoutPromise]);
      Logger.info('rumdl language server stopped successfully');
    } catch (error) {
      Logger.error('Error stopping client', error as Error);
    } finally {
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

  public async executeCommand(command: string, ...args: unknown[]): Promise<unknown> {
    if (!this.client || !this.isRunning()) {
      throw new Error('Language server is not running');
    }

    return this.client.sendRequest('workspace/executeCommand', {
      command,
      arguments: args,
    });
  }

  private findDuplicateDiagnostics(diagnostics: unknown[]): unknown[] {
    const seen = new Set<string>();
    const duplicates: unknown[] = [];

    for (const diagnostic of diagnostics) {
      const d = diagnostic as {
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        message: string;
        code?: string;
      };
      const key = `${d.range.start.line}:${d.range.start.character}-${d.range.end.line}:${d.range.end.character}:${d.message}:${d.code}`;

      if (seen.has(key)) {
        duplicates.push(diagnostic);
      } else {
        seen.add(key);
      }
    }

    return duplicates;
  }

  private deduplicateDiagnostics(diagnostics: unknown[]): unknown[] {
    const seen = new Set<string>();
    const unique: unknown[] = [];

    for (const diagnostic of diagnostics) {
      const d = diagnostic as {
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
        message: string;
        code?: string;
      };
      const key = `${d.range.start.line}:${d.range.start.character}-${d.range.end.line}:${d.range.end.character}:${d.message}:${d.code}`;

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
