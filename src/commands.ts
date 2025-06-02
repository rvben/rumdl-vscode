import * as vscode from 'vscode';
import { RumdlLanguageClient } from './client';
import { Logger, showInformationMessage, showErrorMessage, getRumdlVersion } from './utils';
import { ConfigurationManager } from './configuration';

export class CommandManager implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];

  constructor(private client: RumdlLanguageClient) {}

  public register(context: vscode.ExtensionContext): void {
    // Register all commands
    this.disposables.push(
      vscode.commands.registerCommand('rumdl.fixAll', () => this.fixAll()),
      vscode.commands.registerCommand('rumdl.restartServer', () => this.restartServer()),
      vscode.commands.registerCommand('rumdl.showClientLogs', () => this.showClientLogs()),
      vscode.commands.registerCommand('rumdl.showServerLogs', () => this.showServerLogs()),
      vscode.commands.registerCommand('rumdl.printDebugInfo', () => this.printDebugInfo()),
      vscode.commands.registerCommand('rumdl.checkDuplicateDiagnostics', () => this.checkDuplicateDiagnostics()),
      vscode.commands.registerCommand('rumdl.checkStatus', () => this.checkStatus()),
      vscode.commands.registerCommand('rumdl.testConfigDiscovery', () => this.testConfigDiscovery())
    );

    // Add disposables to context
    context.subscriptions.push(...this.disposables);
  }

  private async fixAll(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      showErrorMessage('No active editor found');
      return;
    }

    if (editor.document.languageId !== 'markdown') {
      showErrorMessage('Current file is not a Markdown file');
      return;
    }

    if (!this.client.isRunning()) {
      showErrorMessage('rumdl server is not running');
      return;
    }

    try {
      Logger.info('Executing fix all command');

      // Get all code actions for the document
      const uri = editor.document.uri.toString();
      const range = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
      );

      const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        editor.document.uri,
        range,
        vscode.CodeActionKind.QuickFix
      );

      if (!codeActions || codeActions.length === 0) {
        showInformationMessage('No auto-fixable issues found');
        return;
      }

      // Filter for rumdl fix actions
      const rumdlFixActions = codeActions.filter(action =>
        action.kind?.value.startsWith('quickfix.rumdl') ||
        action.title.toLowerCase().includes('rumdl')
      );

      if (rumdlFixActions.length === 0) {
        showInformationMessage('No rumdl auto-fixes available');
        return;
      }

      // Apply all fix actions
      let fixedCount = 0;
      for (const action of rumdlFixActions) {
        if (action.edit) {
          const success = await vscode.workspace.applyEdit(action.edit);
          if (success) {
            fixedCount++;
          }
        } else if (action.command) {
          await vscode.commands.executeCommand(action.command.command, ...action.command.arguments || []);
          fixedCount++;
        }
      }

      if (fixedCount > 0) {
        showInformationMessage(`Fixed ${fixedCount} issue${fixedCount === 1 ? '' : 's'}`);
        Logger.info(`Applied ${fixedCount} auto-fixes`);
      } else {
        showErrorMessage('Failed to apply fixes');
      }

    } catch (error) {
      Logger.error('Error executing fix all command', error as Error);
      showErrorMessage(`Failed to fix issues: ${(error as Error).message}`);
    }
  }

  private async restartServer(): Promise<void> {
    try {
      Logger.info('Restart server command executed');
      showInformationMessage('Restarting rumdl server...');
      await this.client.restart();
      showInformationMessage('rumdl server restarted successfully');
    } catch (error) {
      Logger.error('Error restarting server', error as Error);
      showErrorMessage(`Failed to restart server: ${(error as Error).message}`);
    }
  }

  private showClientLogs(): void {
    Logger.info('Show client logs command executed');
    Logger.show();
  }

  private showServerLogs(): void {
    Logger.info('Show server logs command executed');

    const client = this.client.getClient();
    if (client) {
      client.outputChannel.show();
    } else {
      showErrorMessage('Server is not running');
    }
  }

  private async printDebugInfo(): Promise<void> {
    Logger.info('Print debug info command executed');

    const config = ConfigurationManager.getConfiguration();
    const isRunning = this.client.isRunning();
    const workspaceFolders = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [];
    const activeEditor = vscode.window.activeTextEditor;

    // Get rumdl version
    const rumdlVersion = await getRumdlVersion(config.server.path);

    const debugInfo = {
      timestamp: new Date().toISOString(),
      extension: {
        version: vscode.extensions.getExtension('rumdl.rumdl')?.packageJSON.version || 'unknown'
      },
      server: {
        running: isRunning,
        path: config.server.path,
        version: rumdlVersion || 'unknown',
        logLevel: config.server.logLevel
      },
      configuration: {
        ...config,
        configDiscovery: config.configPath ? 'explicit' : 'auto-discovery by rumdl'
      },
      workspace: {
        folders: workspaceFolders,
        activeFile: activeEditor?.document.uri.fsPath || 'none',
        workingDirectory: workspaceFolders[0] || process.cwd()
      },
      vscode: {
        version: vscode.version
      }
    };

    Logger.info('=== DEBUG INFORMATION ===');
    Logger.info(JSON.stringify(debugInfo, null, 2));
    Logger.info('=== END DEBUG INFORMATION ===');

    Logger.show();
    showInformationMessage('Debug information printed to client logs');
  }

  private async checkDuplicateDiagnostics(): Promise<void> {
    Logger.info('Check duplicate diagnostics command executed');

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      showErrorMessage('No active editor found');
      return;
    }

    if (editor.document.languageId !== 'markdown') {
      showErrorMessage('Current file is not a Markdown file');
      return;
    }

    // Get all diagnostics for the current document
    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);

    if (diagnostics.length === 0) {
      showInformationMessage('No diagnostics found for current file');
      return;
    }

    // Group diagnostics by source
    const diagnosticsBySource = new Map<string, vscode.Diagnostic[]>();
    const duplicates: vscode.Diagnostic[] = [];
    const seen = new Set<string>();

    for (const diagnostic of diagnostics) {
      const source = diagnostic.source || 'unknown';

      if (!diagnosticsBySource.has(source)) {
        diagnosticsBySource.set(source, []);
      }
      diagnosticsBySource.get(source)!.push(diagnostic);

      // Check for duplicates
      const key = `${diagnostic.range.start.line}:${diagnostic.range.start.character}-${diagnostic.range.end.line}:${diagnostic.range.end.character}:${diagnostic.message}:${diagnostic.code}`;

      if (seen.has(key)) {
        duplicates.push(diagnostic);
      } else {
        seen.add(key);
      }
    }

    // Log results
    Logger.info('=== DUPLICATE DIAGNOSTICS CHECK ===');
    Logger.info(`Total diagnostics: ${diagnostics.length}`);
    Logger.info(`Duplicate diagnostics: ${duplicates.length}`);
    Logger.info('Diagnostics by source:');

    for (const [source, sourceDiagnostics] of diagnosticsBySource) {
      Logger.info(`  ${source}: ${sourceDiagnostics.length} diagnostics`);
    }

    if (duplicates.length > 0) {
      Logger.info('Duplicate diagnostics found:');
      for (const duplicate of duplicates) {
        Logger.info(`  Line ${duplicate.range.start.line + 1}: ${duplicate.message} (source: ${duplicate.source || 'unknown'})`);
      }
    }

    Logger.info('=== END DUPLICATE DIAGNOSTICS CHECK ===');
    Logger.show();

    if (duplicates.length > 0) {
      showInformationMessage(`Found ${duplicates.length} duplicate diagnostics. Check logs for details.`);
    } else {
      showInformationMessage('No duplicate diagnostics found');
    }
  }

  private async checkStatus(): Promise<void> {
    Logger.info('Check status command executed');

    const config = ConfigurationManager.getConfiguration();
    const isRunning = this.client.isRunning();

    // Get rumdl version
    const rumdlVersion = await getRumdlVersion(config.server.path);

    // Check bundled tools
    const { BundledToolsManager } = await import('./bundledTools');
    const hasBundled = BundledToolsManager.hasBundledTools();
    const bundledVersion = BundledToolsManager.getBundledVersion();
    const bundledPath = BundledToolsManager.getBundledRumdlPath();

    let statusMessage = '🔍 rumdl Extension Status Check\n\n';

    // Extension status
    statusMessage += `✅ Extension: Active\n`;
    statusMessage += `📦 Version: ${vscode.extensions.getExtension('rumdl.rumdl')?.packageJSON.version || 'unknown'}\n\n`;

    // Server status
    statusMessage += `🖥️ Server Status: ${isRunning ? '✅ Running' : '❌ Not Running'}\n`;
    statusMessage += `📍 rumdl Path: ${config.server.path}\n`;
    statusMessage += `🏷️ rumdl Version: ${rumdlVersion || '❌ Not detected'}\n\n`;

    // Bundled tools status
    statusMessage += `📦 Bundled Tools: ${hasBundled ? '✅ Available' : '❌ Not found'}\n`;
    if (bundledVersion) {
      statusMessage += `🏷️ Bundled Version: ${bundledVersion.version}\n`;
      statusMessage += `📍 Bundled Path: ${bundledPath || 'Not available for this platform'}\n`;
    }
    statusMessage += '\n';

    // Configuration
    statusMessage += `⚙️ Configuration:\n`;
    statusMessage += `  • Enabled: ${config.enable ? '✅' : '❌'}\n`;
    statusMessage += `  • Log Level: ${config.server.logLevel}\n`;
    statusMessage += `  • Selected Rules: ${config.rules.select.length > 0 ? config.rules.select.join(', ') : 'All'}\n`;
    statusMessage += `  • Ignored Rules: ${config.rules.ignore.length > 0 ? config.rules.ignore.join(', ') : 'None'}\n\n`;

    // Workspace info
    const workspaceFolders = vscode.workspace.workspaceFolders?.map(f => f.name) || [];
    statusMessage += `📁 Workspace: ${workspaceFolders.length > 0 ? workspaceFolders.join(', ') : 'No workspace'}\n`;

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === 'markdown') {
      statusMessage += `📄 Active File: ${activeEditor.document.fileName} (Markdown)\n`;
      const diagnostics = vscode.languages.getDiagnostics(activeEditor.document.uri);
      statusMessage += `🔍 Diagnostics: ${diagnostics.length} issues found\n`;
    } else {
      statusMessage += `📄 Active File: ${activeEditor ? 'Not a Markdown file' : 'None'}\n`;
    }

    // Show the status in a modal
    const action = await vscode.window.showInformationMessage(
      statusMessage,
      { modal: true },
      'Show Logs',
      'Restart Server'
    );

    if (action === 'Show Logs') {
      Logger.show();
    } else if (action === 'Restart Server') {
      await this.restartServer();
    }

    // Also log to output
    Logger.info('=== STATUS CHECK ===');
    Logger.info(statusMessage);
    Logger.info('=== END STATUS CHECK ===');
  }

  private async testConfigDiscovery(): Promise<void> {
    Logger.info('Test configuration discovery command executed');

    const config = ConfigurationManager.getConfiguration();
    const workspaceFolders = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [];
    const workingDirectory = workspaceFolders[0] || process.cwd();

    let discoveryReport = '🔍 Configuration Discovery Test\n\n';

    // Working directory info
    discoveryReport += `📁 Working Directory: ${workingDirectory}\n\n`;

    // Check for config files in workspace
    discoveryReport += `📋 Searching for configuration files:\n`;

    const configFiles = [
      '.rumdl.toml',
      'rumdl.toml',
      '.markdownlint.json',
      '.markdownlint.jsonc',
      '.markdownlint.yaml',
      '.markdownlint.yml'
    ];

    const fs = require('fs');
    const path = require('path');
    const foundFiles: string[] = [];

    for (const configFile of configFiles) {
      const configPath = path.join(workingDirectory, configFile);
      const exists = fs.existsSync(configPath);
      discoveryReport += `  ${exists ? '✅' : '❌'} ${configFile}\n`;
      if (exists) {
        foundFiles.push(configFile);
        try {
          const stats = fs.statSync(configPath);
          discoveryReport += `     📄 Size: ${stats.size} bytes, Modified: ${stats.mtime.toISOString()}\n`;
        } catch (error) {
          discoveryReport += `     ⚠️ Error reading file stats: ${error}\n`;
        }
      }
    }

    // VS Code configuration
    discoveryReport += `\n⚙️ VS Code Configuration:\n`;
    discoveryReport += `  • Config Path: ${config.configPath || 'not set (auto-discovery)'}\n`;
    discoveryReport += `  • Selected Rules: ${config.rules.select.length > 0 ? config.rules.select.join(', ') : 'none'}\n`;
    discoveryReport += `  • Ignored Rules: ${config.rules.ignore.length > 0 ? config.rules.ignore.join(', ') : 'none'}\n`;

    // Test rumdl configuration discovery
    discoveryReport += `\n🔧 Testing rumdl Configuration Discovery:\n`;

    try {
      const { BundledToolsManager } = await import('./bundledTools');
      const rumdlPath = await BundledToolsManager.getBestRumdlPath(config.server.path);

      discoveryReport += `  • rumdl Path: ${rumdlPath}\n`;
      discoveryReport += `  • Working Dir: ${workingDirectory}\n`;

      // Test the new 'config file' command from rumdl 0.0.78+
      const { spawn } = require('child_process');

      // First, test 'rumdl config file' to see what config file rumdl actually uses
      const configFileResult = await new Promise<string>((resolve) => {
        const process = spawn(rumdlPath, ['config', 'file'], {
          cwd: workingDirectory,
          stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';

        process.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        process.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        process.on('exit', (code: number | null) => {
          resolve(`Exit code: ${code}\nSTDOUT:\n${output}\nSTDERR:\n${errorOutput}`);
        });

        process.on('error', (error: Error) => {
          resolve(`Process error: ${error.message}`);
        });

        setTimeout(() => {
          process.kill();
          resolve('Process timeout after 5 seconds');
        }, 5000);
      });

      discoveryReport += `\n📍 Active Configuration File (rumdl config file):\n`;
      discoveryReport += `${configFileResult}\n`;

      // Also test the help command for reference
      const helpResult = await new Promise<string>((resolve) => {
        const process = spawn(rumdlPath, ['check', '--help'], {
          cwd: workingDirectory,
          stdio: 'pipe'
        });

        let output = '';
        let errorOutput = '';

        process.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        process.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        process.on('exit', (code: number | null) => {
          resolve(`Exit code: ${code}\nSTDOUT:\n${output}\nSTDERR:\n${errorOutput}`);
        });

        process.on('error', (error: Error) => {
          resolve(`Process error: ${error.message}`);
        });

        setTimeout(() => {
          process.kill();
          resolve('Process timeout after 5 seconds');
        }, 5000);
      });

      discoveryReport += `\n📤 rumdl Check Help:\n${helpResult.split('\n').slice(0, 10).join('\n')}\n... (truncated)\n`;

      // If we found config files, try to read the first one
      if (foundFiles.length > 0) {
        const firstConfigFile = foundFiles[0];
        const configPath = path.join(workingDirectory, firstConfigFile);

        discoveryReport += `\n📖 Reading Configuration File: ${firstConfigFile}\n`;
        try {
          const configContent = fs.readFileSync(configPath, 'utf8');
          const truncatedContent = configContent.length > 500
            ? configContent.substring(0, 500) + '\n... (truncated)'
            : configContent;
          discoveryReport += `\`\`\`\n${truncatedContent}\n\`\`\`\n`;
        } catch (error) {
          discoveryReport += `❌ Error reading config file: ${error}\n`;
        }
      }

    } catch (error) {
      discoveryReport += `❌ Error testing rumdl: ${error}\n`;
    }

    // Show recommendations
    discoveryReport += `\n💡 Recommendations:\n`;
    if (foundFiles.length === 0) {
      discoveryReport += `  • No configuration files found. Create a .rumdl.toml file in your workspace root\n`;
      discoveryReport += `  • Example .rumdl.toml:\n`;
      discoveryReport += `    \`\`\`toml\n`;
      discoveryReport += `    [rules.MD013]\n`;
      discoveryReport += `    line_length = 200\n`;
      discoveryReport += `    \`\`\`\n`;
    } else {
      discoveryReport += `  • Found ${foundFiles.length} config file(s): ${foundFiles.join(', ')}\n`;
      discoveryReport += `  • Check the "Active Configuration File" section above to see which one rumdl is actually using\n`;
      discoveryReport += `  • If rumdl shows "No config file found" but files exist, check file syntax and permissions\n`;
      discoveryReport += `  • If settings aren't applied, verify the configuration syntax matches rumdl's expected format\n`;
    }

    discoveryReport += `\n🔍 Advanced Debugging:\n`;
    discoveryReport += `  • Use 'rumdl config file' command from terminal to check config discovery in any directory\n`;
    discoveryReport += `  • Use 'rumdl check --help' to see all available configuration options\n`;
    discoveryReport += `  • Check rumdl server logs in VS Code for detailed configuration loading messages\n`;

    // Show in modal and logs
    const action = await vscode.window.showInformationMessage(
      discoveryReport,
      { modal: true },
      'Show Logs',
      'Create .rumdl.toml'
    );

    if (action === 'Show Logs') {
      Logger.show();
    } else if (action === 'Create .rumdl.toml') {
      await this.createSampleConfig(workingDirectory);
    }

    // Log to output
    Logger.info('=== CONFIGURATION DISCOVERY TEST ===');
    Logger.info(discoveryReport);
    Logger.info('=== END CONFIGURATION DISCOVERY TEST ===');
  }

  private async createSampleConfig(workingDirectory: string): Promise<void> {
    const configPath = require('path').join(workingDirectory, '.rumdl.toml');
    const sampleConfig = `# rumdl configuration file
# See: https://github.com/rvben/rumdl#configuration

[rules]
# Select specific rules (empty = all rules)
select = []

# Ignore specific rules
ignore = []

# Rule-specific configuration
[rules.MD013]
line_length = 200
code_blocks = false
tables = false

[rules.MD003]
style = "atx"  # Use ATX style headings (##)

[rules.MD007]
indent = 4  # 4 spaces for unordered list indentation

# File patterns to include/exclude
[files]
include = ["**/*.md", "**/*.markdown"]
exclude = [
  "node_modules/**",
  "target/**",
  "build/**",
  "dist/**"
]
`;

    try {
      const fs = require('fs');
      fs.writeFileSync(configPath, sampleConfig);
      vscode.window.showInformationMessage(
        `Created .rumdl.toml configuration file at ${configPath}. Restart the rumdl server to apply changes.`,
        'Restart Server'
      ).then(action => {
        if (action === 'Restart Server') {
          this.restartServer();
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create config file: ${error}`);
    }
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}