import * as vscode from 'vscode';
import { RumdlLanguageClient } from './client';
import { StatusBarManager } from './statusBar';
import { CommandManager } from './commands';
import { ConfigurationManager, RumdlConfig, shouldRunLanguageServer } from './configuration';
import { Logger, showErrorMessage, isSupportedDocument } from './utils';
import { BundledToolsManager } from './bundledTools';
import { ConfigDiagnosticProvider } from './diagnostics/configDiagnostics';

let client: RumdlLanguageClient;
let statusBar: StatusBarManager;
let commands: CommandManager;
let configWatcher: vscode.Disposable;
let configDiagnostics: ConfigDiagnosticProvider;
let reconciliationQueue: Promise<void> = Promise.resolve();

export async function activate(
  context: vscode.ExtensionContext
): Promise<{ client: RumdlLanguageClient }> {
  // Initialize logger first
  Logger.initialize('rumdl');

  Logger.info('Activating rumdl extension...');

  // Log bundled tools information
  BundledToolsManager.logBundledToolsInfo();

  try {
    // Initialize status bar
    statusBar = new StatusBarManager();
    context.subscriptions.push(statusBar);

    // Initialize language client
    client = new RumdlLanguageClient(statusBar);
    context.subscriptions.push(client);

    // Initialize command manager
    commands = new CommandManager(client);
    context.subscriptions.push(commands);

    // Initialize configuration diagnostics
    configDiagnostics = new ConfigDiagnosticProvider();
    context.subscriptions.push(configDiagnostics);

    // Start the client if enabled
    if (shouldRunLanguageServer(ConfigurationManager.isEnabled(), vscode.workspace.isTrusted)) {
      await client.start();
    } else {
      setInactiveStatus(ConfigurationManager.getConfiguration());
    }

    // Watch for configuration changes
    configWatcher = ConfigurationManager.onConfigurationChanged(config => {
      Logger.info('Configuration changed, reconciling language server state');
      void enqueueReconciliation(config);
    });

    context.subscriptions.push(configWatcher);

    // Register commands
    commands.register(context);

    // Show status bar
    statusBar.show();

    // Register additional event handlers
    registerEventHandlers(context);

    // Initialize status bar with current document if any
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && isSupportedDocument(activeEditor.document)) {
      updateStatusBarForDocument(activeEditor.document);
    }

    Logger.info('rumdl extension activated successfully');

    // Update status bar to show extension is ready
    if (shouldRunLanguageServer(ConfigurationManager.isEnabled(), vscode.workspace.isTrusted)) {
      // Status will be updated by the client when it connects
    } else {
      setInactiveStatus(ConfigurationManager.getConfiguration());
    }

    // Return the client for testing purposes
    return { client };
  } catch (error) {
    Logger.error('Failed to activate rumdl extension', error as Error);
    showErrorMessage(
      'Failed to activate rumdl extension. Check the output for details.',
      'Show Logs'
    ).then(action => {
      if (action === 'Show Logs') {
        Logger.show();
      }
    });

    // Still return client even if there was an error
    return { client };
  }
}

function setInactiveStatus(config: RumdlConfig): void {
  if (!vscode.workspace.isTrusted) {
    Logger.info('rumdl diagnostics are disabled because the workspace is not trusted');
    statusBar.setDisconnected('Workspace is not trusted');
    return;
  }

  Logger.info('rumdl is disabled in configuration');
  statusBar.setDisconnected(config.enable ? 'Not running' : 'Disabled in settings');
}

async function reconcileClientState(config: RumdlConfig): Promise<void> {
  if (!shouldRunLanguageServer(config.enable, vscode.workspace.isTrusted)) {
    // Stop even when the client is between crash-recovery attempts: stop()
    // also invalidates any pending restart timer.
    await client.stop();
    setInactiveStatus(config);
    return;
  }

  // restart() handles both a running client and a previous failed/stopped
  // instance, so configuration changes always get a genuine retry.
  await client.restart();
}

function enqueueReconciliation(config: RumdlConfig): Promise<void> {
  reconciliationQueue = reconciliationQueue
    .then(() => reconcileClientState(config))
    .catch(error => {
      Logger.error('Failed to reconcile rumdl language server state', error as Error);
      statusBar.setError('Failed to apply settings');
    });
  return reconciliationQueue;
}

function registerEventHandlers(context: vscode.ExtensionContext): void {
  // Handle workspace folder changes
  const workspaceFoldersWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async event => {
    Logger.info(`Workspace folders changed: +${event.added.length}, -${event.removed.length}`);

    // Restart server to pick up new workspace configuration
    if (
      client.isRunning() &&
      shouldRunLanguageServer(ConfigurationManager.isEnabled(), vscode.workspace.isTrusted)
    ) {
      await client.restart();
    }
  });

  const workspaceTrustWatcher = vscode.workspace.onDidGrantWorkspaceTrust(() => {
    Logger.info('Workspace trust granted, enabling rumdl diagnostics');
    void enqueueReconciliation(ConfigurationManager.getConfiguration());
  });

  // Handle active editor changes to update status
  const activeEditorWatcher = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && isSupportedDocument(editor.document)) {
      Logger.debug(`Active editor changed to Markdown file: ${editor.document.uri.fsPath}`);
      updateStatusBarForDocument(editor.document);
    } else {
      statusBar.updateIssueCount(0, 0);
    }
  });

  // Handle diagnostics changes to update status bar
  const diagnosticsWatcher = vscode.languages.onDidChangeDiagnostics(event => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && isSupportedDocument(activeEditor.document)) {
      // Check if the active document's URI is in the changed URIs
      const docUri = activeEditor.document.uri;
      if (event.uris.some(uri => uri.toString() === docUri.toString())) {
        updateStatusBarForDocument(activeEditor.document);
      }
    }
  });

  context.subscriptions.push(
    workspaceFoldersWatcher,
    workspaceTrustWatcher,
    activeEditorWatcher,
    diagnosticsWatcher
  );
}

function updateStatusBarForDocument(document: vscode.TextDocument): void {
  // Get diagnostics for the current document
  const diagnostics = vscode.languages.getDiagnostics(document.uri);

  // Filter for rumdl diagnostics (you might want to check the source)
  const rumdlDiagnostics = diagnostics.filter(
    d => d.source === 'rumdl' || d.source === 'rumdl Language Server'
  );

  // Count total and fixable issues
  const totalIssues = rumdlDiagnostics.length;
  // We consider issues with code actions as potentially fixable
  // In reality, we'd need to check if the diagnostic has associated code actions
  // For now, we'll estimate based on severity
  const fixableIssues = rumdlDiagnostics.filter(
    d =>
      d.severity === vscode.DiagnosticSeverity.Warning ||
      d.severity === vscode.DiagnosticSeverity.Information
  ).length;

  statusBar.updateIssueCount(totalIssues, fixableIssues);
}

export async function deactivate(): Promise<void> {
  Logger.info('rumdl extension deactivating...');

  try {
    // Stop the language client
    if (client) {
      await client.stop();
    }

    // Dispose configuration watcher
    if (configWatcher) {
      configWatcher.dispose();
    }

    // Dispose logger
    Logger.dispose();

    Logger.info('rumdl extension deactivated successfully');
  } catch (error) {
    Logger.error('Error during deactivation', error as Error);
  }
}
