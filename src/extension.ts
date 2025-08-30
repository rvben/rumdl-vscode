import * as vscode from 'vscode';
import { RumdlLanguageClient } from './client';
import { StatusBarManager } from './statusBar';
import { CommandManager } from './commands';
import { ConfigurationManager } from './configuration';
import { Logger, showErrorMessage } from './utils';
import { BundledToolsManager } from './bundledTools';
import { ConfigDiagnosticProvider } from './diagnostics/configDiagnostics';

let client: RumdlLanguageClient;
let statusBar: StatusBarManager;
let commands: CommandManager;
let configWatcher: vscode.Disposable;
let configDiagnostics: ConfigDiagnosticProvider;

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
    if (ConfigurationManager.isEnabled()) {
      await client.start();
    } else {
      Logger.info('rumdl is disabled in configuration');
      statusBar.setDisconnected('Disabled in settings');
    }

    // Watch for configuration changes
    configWatcher = ConfigurationManager.onConfigurationChanged(async config => {
      Logger.info('Configuration changed, restarting server if needed');

      if (config.enable && client.isRunning()) {
        // Restart server with new configuration
        await client.restart();
      } else if (config.enable && !client.isRunning()) {
        // Start server if it was disabled and now enabled
        await client.start();
      } else if (!config.enable && client.isRunning()) {
        // Stop server if disabled
        await client.stop();
        statusBar.setDisconnected('Disabled in settings');
      }
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
    if (activeEditor && activeEditor.document.languageId === 'markdown') {
      updateStatusBarForDocument(activeEditor.document);
    }

    Logger.info('rumdl extension activated successfully');

    // Update status bar to show extension is ready
    if (ConfigurationManager.isEnabled()) {
      // Status will be updated by the client when it connects
    } else {
      statusBar.setDisconnected('Ready (disabled in settings)');
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

function registerEventHandlers(context: vscode.ExtensionContext): void {
  // Handle workspace folder changes
  const workspaceFoldersWatcher = vscode.workspace.onDidChangeWorkspaceFolders(async event => {
    Logger.info(`Workspace folders changed: +${event.added.length}, -${event.removed.length}`);

    // Restart server to pick up new workspace configuration
    if (client.isRunning()) {
      await client.restart();
    }
  });

  // Handle active editor changes to update status
  const activeEditorWatcher = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor && editor.document.languageId === 'markdown') {
      Logger.debug(`Active editor changed to Markdown file: ${editor.document.uri.fsPath}`);
      updateStatusBarForDocument(editor.document);
    } else {
      // Clear issue count when not in a markdown file
      statusBar.updateIssueCount(0, 0);
    }
  });

  // Handle document saves to trigger re-linting
  const documentSaveWatcher = vscode.workspace.onDidSaveTextDocument(document => {
    if (document.languageId === 'markdown') {
      Logger.debug(`Markdown document saved: ${document.uri.fsPath}`);
    }
  });

  // Handle diagnostics changes to update status bar
  const diagnosticsWatcher = vscode.languages.onDidChangeDiagnostics(event => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === 'markdown') {
      // Check if the active document's URI is in the changed URIs
      const docUri = activeEditor.document.uri;
      if (event.uris.some(uri => uri.toString() === docUri.toString())) {
        updateStatusBarForDocument(activeEditor.document);
      }
    }
  });

  context.subscriptions.push(workspaceFoldersWatcher, activeEditorWatcher, documentSaveWatcher, diagnosticsWatcher);
}

function updateStatusBarForDocument(document: vscode.TextDocument): void {
  // Get diagnostics for the current document
  const diagnostics = vscode.languages.getDiagnostics(document.uri);
  
  // Filter for rumdl diagnostics (you might want to check the source)
  const rumdlDiagnostics = diagnostics.filter(d => 
    d.source === 'rumdl' || d.source === 'rumdl Language Server'
  );
  
  // Count total and fixable issues
  const totalIssues = rumdlDiagnostics.length;
  // We consider issues with code actions as potentially fixable
  // In reality, we'd need to check if the diagnostic has associated code actions
  // For now, we'll estimate based on severity
  const fixableIssues = rumdlDiagnostics.filter(d => 
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
