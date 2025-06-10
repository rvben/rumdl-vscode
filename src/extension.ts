import * as vscode from 'vscode';
import { RumdlLanguageClient } from './client';
import { StatusBarManager } from './statusBar';
import { CommandManager } from './commands';
import { ConfigurationManager } from './configuration';
import { Logger, showErrorMessage } from './utils';
import { BundledToolsManager } from './bundledTools';

let client: RumdlLanguageClient;
let statusBar: StatusBarManager;
let commands: CommandManager;
let configWatcher: vscode.Disposable;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
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

    Logger.info('rumdl extension activated successfully');

    // Update status bar to show extension is ready
    if (ConfigurationManager.isEnabled()) {
      // Status will be updated by the client when it connects
    } else {
      statusBar.setDisconnected('Ready (disabled in settings)');
    }
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
    }
  });

  // Handle document saves to trigger re-linting
  const documentSaveWatcher = vscode.workspace.onDidSaveTextDocument(document => {
    if (document.languageId === 'markdown') {
      Logger.debug(`Markdown document saved: ${document.uri.fsPath}`);
    }
  });

  context.subscriptions.push(workspaceFoldersWatcher, activeEditorWatcher, documentSaveWatcher);
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
