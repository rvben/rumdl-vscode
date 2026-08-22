import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  State,
  RevealOutputChannelOn,
  ErrorAction,
  CloseAction,
} from 'vscode-languageclient/node';
import { ConfigurationManager, RumdlConfig, shouldRunLanguageServer } from './configuration';
import {
  Logger,
  checkRumdlInstallation,
  getRumdlVersion,
  showErrorMessage,
  ALL_SUPPORTED_LANGUAGE_IDS,
} from './utils';
import { StatusBarManager } from './statusBar';
import { BundledToolsManager } from './bundledTools';
import { DiagnosticLike, deduplicate } from './diagnosticDedup';
import { DiagnosticPullGate } from './diagnosticPullGate';
import { ServerRestartPolicy } from './restartPolicy';

/**
 * LSP initialization options sent to the rumdl server.
 *
 * Field names use camelCase per the LSP specification (rumdl v0.0.171+).
 * `undefined` fields are omitted by the JSON-RPC layer, signaling "use server default".
 */
export interface RumdlInitializationOptions {
  configPath: string | undefined;
  enableLinting: true;
  enableAutoFix: boolean;
  enableRules: string[] | undefined;
  disableRules: string[] | undefined;
  enableLinkCompletions: boolean;
  linkCompletionContentRoots: string[] | undefined;
  enableLinkNavigation: boolean;
}

/**
 * Build LSP initialization options from a fully-populated configuration.
 *
 * This is exported so tests can verify the transformation without touching the
 * VS Code workspace configuration API. The input must be a complete RumdlConfig
 * (as produced by ConfigurationManager.getConfiguration), so defaults are applied
 * exactly once — at the configuration boundary, not duplicated here.
 */
export function buildInitializationOptions(config: RumdlConfig): RumdlInitializationOptions {
  return {
    configPath:
      config.configPath && config.configPath.trim() !== '' ? config.configPath : undefined,
    enableLinting: true,
    enableAutoFix: config.fixOnSave,
    enableRules: config.rules.enable.length > 0 ? config.rules.enable : undefined,
    disableRules: config.rules.disable.length > 0 ? config.rules.disable : undefined,
    enableLinkCompletions: config.linkCompletions.enable,
    linkCompletionContentRoots:
      config.linkCompletions.contentRoots.length > 0
        ? config.linkCompletions.contentRoots
        : undefined,
    enableLinkNavigation: config.linkNavigation.enable,
  };
}

/** When the client asks the server for diagnostics. */
export interface DiagnosticPullOptions {
  onChange: boolean;
  onSave: boolean;
}

/**
 * Translate `rumdl.lint.run` into the language client's pull schedule.
 *
 * rumdl serves diagnostics over the pull model (textDocument/diagnostic), so
 * this schedule decides when findings refresh. `onType` is the language
 * client's own default schedule; `onSave` holds the last saved results steady
 * while editing, for people who find a re-lint on every keystroke distracting.
 *
 * Exported so tests can verify the mapping without launching a server.
 */
export function buildDiagnosticPullOptions(config: RumdlConfig): DiagnosticPullOptions {
  const onSave = config.lint.run === 'onSave';
  return { onChange: !onSave, onSave };
}

export class RumdlLanguageClient implements vscode.Disposable {
  private client: LanguageClient | undefined;
  private statusBar: StatusBarManager;
  private isDisposed = false;
  private stopRequested = false;
  private lifecycleGeneration = 0;
  private readonly restartPolicy = new ServerRestartPolicy();
  private diagnosticPullGate: DiagnosticPullGate | undefined;
  private diagnosticCacheCloseWatcher: vscode.Disposable | undefined;

  constructor(statusBar: StatusBarManager) {
    this.statusBar = statusBar;
  }

  public async start(): Promise<void> {
    if (this.isDisposed) {
      Logger.warn('Cannot start a disposed rumdl language client');
      return;
    }

    if (this.client) {
      Logger.warn('Client is already running');
      return;
    }

    try {
      Logger.info('Starting rumdl language client...');

      // Log bundled tools information
      BundledToolsManager.logBundledToolsInfo();

      const config = ConfigurationManager.getConfiguration();
      if (!shouldRunLanguageServer(config.enable, vscode.workspace.isTrusted)) {
        const reason = config.enable ? 'Workspace is not trusted' : 'Disabled in settings';
        Logger.info(`Not starting rumdl language server: ${reason}`);
        this.statusBar.setDisconnected(reason);
        return;
      }

      this.stopRequested = false;

      // Get the best available rumdl path (bundled first, then configured/system)
      const rumdlPath = await BundledToolsManager.getBestRumdlPath(config.server.path);

      // Determine working directory (workspace root or current directory).
      // Computed before the install check so it can be used as the spawn cwd:
      // the server is launched with this cwd, so the check must use it too or a
      // version-manager shim (mise, asdf, …) can't resolve the project-pinned
      // tool and the check fails even though the server would work.
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workingDirectory = workspaceFolder?.uri.fsPath || process.cwd();

      // Check if rumdl is available
      const isInstalled = await checkRumdlInstallation(rumdlPath, workingDirectory);
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
      const version = await getRumdlVersion(rumdlPath, workingDirectory);
      if (version) {
        Logger.info(`Using rumdl version: ${version}`);
      }

      this.statusBar.setStarting();

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

      const initializationOptions = buildInitializationOptions(config);
      this.prepareDiagnosticPullGate(config);

      const clientOptions: LanguageClientOptions = {
        documentSelector: ALL_SUPPORTED_LANGUAGE_IDS.flatMap(language => [
          { scheme: 'file', language },
          { scheme: 'untitled', language },
        ]),
        synchronize: {
          fileEvents: [
            vscode.workspace.createFileSystemWatcher('**/.rumdl.toml'),
            vscode.workspace.createFileSystemWatcher('**/rumdl.toml'),
            vscode.workspace.createFileSystemWatcher('**/.config/rumdl.toml'),
            vscode.workspace.createFileSystemWatcher('**/pyproject.toml'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.json'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.jsonc'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.yaml'),
            vscode.workspace.createFileSystemWatcher('**/.markdownlint.yml'),
          ],
        },
        outputChannelName: 'rumdl Language Server',
        revealOutputChannelOn: RevealOutputChannelOn.Never,
        errorHandler: {
          error: (_error, _message, count) => ({
            action: count !== undefined && count <= 3 ? ErrorAction.Continue : ErrorAction.Shutdown,
          }),
          // Automatic recovery is owned by RumdlLanguageClient so it can
          // distinguish crashes from settings changes and apply one bounded,
          // observable backoff policy.
          closed: () => ({ action: CloseAction.DoNotRestart }),
        },
        traceOutputChannel:
          ConfigurationManager.getTraceLevel() !== 'off'
            ? vscode.window.createOutputChannel('rumdl Language Server Trace')
            : undefined,
        diagnosticCollectionName: 'rumdl',
        diagnosticPullOptions: buildDiagnosticPullOptions(config),
        middleware: {
          // Diagnostics reach the editor two ways - pushed by the server, and
          // pulled by the client - and each has its own collection, so both are
          // deduplicated here. These hooks wrap the client's own handlers and
          // pass the result on through `next`, leaving delivery to the library.
          handleDiagnostics: (uri, diagnostics, next) => {
            Logger.debug(`Received pushed diagnostics for ${uri}: ${diagnostics.length} issues`);
            next(uri, this.dedupeDiagnostics(diagnostics, `push ${uri}`));
          },
          provideDiagnostics: async (document, previousResultId, token, next) => {
            const uri = document instanceof vscode.Uri ? document : document.uri;
            const heldReport = this.diagnosticPullGate?.heldReport(
              uri.toString(),
              this.isDirty(document)
            );
            if (heldReport) {
              Logger.debug(`Holding saved diagnostics for dirty document ${uri}`);
              return heldReport;
            }

            const report = await next(document, previousResultId, token);
            if (report && 'items' in report) {
              Logger.debug(`Pulled diagnostics for ${uri}: ${report.items.length} issues`);
              const acceptedReport = {
                ...report,
                items: this.dedupeDiagnostics(report.items, `pull ${uri}`),
              };
              this.diagnosticPullGate?.remember(uri.toString(), acceptedReport);
              return acceptedReport;
            }
            return report;
          },
        },
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
            break;
          case State.Stopped:
            if (!this.isDisposed) {
              this.statusBar.setDisconnected();
              if (!this.stopRequested) {
                void this.handleServerStop();
              }
            }
            break;
        }
      });

      // Start the client
      await this.client.start();
      Logger.info('rumdl language server started successfully');
    } catch (error) {
      // Invalidate any recovery scheduled by a failed LanguageClient start and
      // release the reference so a settings change or manual restart can retry.
      this.stopRequested = true;
      this.lifecycleGeneration++;
      const failedClient = this.client;
      this.client = undefined;
      if (failedClient) {
        try {
          await failedClient.stop();
        } catch {
          // The language client may already be in StartFailed/Stopped state.
        }
      }
      this.clearDiagnosticPullGate();
      Logger.error('Failed to start rumdl language server', error as Error);
      this.statusBar.setError('Failed to start');
      throw error;
    }
  }

  private async handleServerStop(): Promise<void> {
    if (this.isDisposed || this.stopRequested) {
      return;
    }

    const decision = this.restartPolicy.next();
    if (!decision) {
      Logger.error('Server stopped after 5 restart attempts in 3 minutes');
      this.statusBar.setError('Too many restarts');
      void showErrorMessage(
        'rumdl has stopped after repeated crashes. Review the server logs, then use “rumdl: Restart Server” to try again.',
        'Show Logs'
      ).then(action => {
        if (action === 'Show Logs') {
          void vscode.commands.executeCommand('rumdl.showServerLogs');
        }
      });
      return;
    }

    const generation = this.lifecycleGeneration;
    Logger.warn(
      `Server stopped unexpectedly. Attempting restart ${decision.attempt}/5 in ${decision.delayMs}ms`
    );

    await new Promise(resolve => setTimeout(resolve, decision.delayMs));

    const config = ConfigurationManager.getConfiguration();
    if (
      this.isDisposed ||
      this.stopRequested ||
      generation !== this.lifecycleGeneration ||
      !shouldRunLanguageServer(config.enable, vscode.workspace.isTrusted)
    ) {
      Logger.info('Cancelled automatic restart because the desired server state changed');
      return;
    }

    try {
      await this.restartClient();
    } catch (error) {
      Logger.error('Failed to restart server', error as Error);
    }
  }

  public async restart(): Promise<void> {
    Logger.info('Restarting rumdl language server');
    this.restartPolicy.reset();

    await this.restartClient();
  }

  private async restartClient(): Promise<void> {
    try {
      if (this.client) {
        await this.stop();
      }

      await this.start();
      Logger.info('rumdl language server restarted successfully');
    } catch (error) {
      Logger.error('Failed to restart rumdl language server', error as Error);
      this.statusBar.setError('Restart failed');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.stopRequested = true;
    this.lifecycleGeneration++;

    if (!this.client) {
      this.clearDiagnosticPullGate();
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
      this.clearDiagnosticPullGate();
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

  /**
   * Create a cache scoped to one language-client lifetime. Closing a document
   * or restarting the server must discard its report so a later open cannot
   * inherit diagnostics from an unrelated document instance.
   */
  private prepareDiagnosticPullGate(config: RumdlConfig): void {
    this.clearDiagnosticPullGate();
    const holdWhileDirty = config.lint.run === 'onSave';
    this.diagnosticPullGate = new DiagnosticPullGate(holdWhileDirty);
    if (holdWhileDirty) {
      this.diagnosticCacheCloseWatcher = vscode.workspace.onDidCloseTextDocument(document => {
        this.diagnosticPullGate?.forget(document.uri.toString());
      });
    }
  }

  private clearDiagnosticPullGate(): void {
    this.diagnosticCacheCloseWatcher?.dispose();
    this.diagnosticCacheCloseWatcher = undefined;
    this.diagnosticPullGate?.clear();
    this.diagnosticPullGate = undefined;
  }

  private isDirty(document: vscode.TextDocument | vscode.Uri): boolean {
    if (!(document instanceof vscode.Uri)) {
      return document.isDirty;
    }

    return (
      vscode.workspace.textDocuments.find(
        candidate => candidate.uri.toString() === document.toString()
      )?.isDirty ?? false
    );
  }

  /**
   * Drop diagnostics that repeat an earlier one, logging what was found.
   *
   * Duplicates are always reported to the log so they remain diagnosable; they
   * are only removed when `rumdl.diagnostics.deduplicate` is on. The array is
   * returned unchanged when there is nothing to remove.
   */
  private dedupeDiagnostics<T extends DiagnosticLike>(diagnostics: T[], label: string): T[] {
    if (diagnostics.length < 2) {
      return diagnostics;
    }

    const unique = deduplicate(diagnostics);
    if (unique.length === diagnostics.length) {
      return diagnostics;
    }

    Logger.warn(`Found ${diagnostics.length - unique.length} duplicate diagnostics (${label})`);
    if (!ConfigurationManager.shouldDeduplicate()) {
      return diagnostics;
    }

    Logger.info(`Deduplicated diagnostics: ${diagnostics.length} -> ${unique.length} (${label})`);
    return unique;
  }

  public dispose(): void {
    this.isDisposed = true;
    this.stopRequested = true;
    this.lifecycleGeneration++;
    this.clearDiagnosticPullGate();
    if (this.client) {
      void this.client.stop().catch(error => {
        Logger.error('Error disposing language client', error as Error);
      });
      this.client = undefined;
    }
  }
}
