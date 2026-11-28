import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigValidator } from '../configValidator';

/**
 * Diagnostic provider for rumdl configuration files
 */
export class ConfigDiagnosticProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private pending = new Map<string, NodeJS.Timeout>();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('rumdl-config');
    this.disposables.push(this.diagnosticCollection);

    // Register event handlers
    this.registerEventHandlers();

    // Run initial validation on open config files
    this.validateOpenConfigFiles();
  }

  /**
   * Register event handlers for document changes
   */
  private registerEventHandlers(): void {
    // Validate on file open
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument(document => {
        if (this.isConfigFile(document)) {
          this.validateDocument(document);
        }
      })
    );

    // Validate on file change
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        if (this.isConfigFile(event.document)) {
          // Debounce validation to avoid excessive processing
          this.validateDocumentDebounced(event.document);
        }
      })
    );

    // Clear diagnostics on file close
    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument(document => {
        if (this.isConfigFile(document)) {
          this.clearDocument(document.uri);
        }
      })
    );

    // A deleted file can remain loaded after its editor closes.
    this.disposables.push(
      vscode.workspace.onDidDeleteFiles(event => {
        for (const document of vscode.workspace.textDocuments) {
          const uri = document.uri;
          if (
            event.files.some(
              deleted =>
                uri.scheme === deleted.scheme &&
                uri.authority === deleted.authority &&
                (uri.path === deleted.path || uri.path.startsWith(deleted.path + '/'))
            )
          ) {
            this.clearDocument(uri);
          }
        }
      })
    );

    // Register code action provider for quick fixes
    this.disposables.push(
      vscode.languages.registerCodeActionsProvider(
        [
          { scheme: 'file', pattern: '**/.rumdl.toml' },
          { scheme: 'file', pattern: '**/rumdl.toml' },
          { scheme: 'file', pattern: '**/pyproject.toml' },
        ],
        new ConfigCodeActionProvider(),
        {
          providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
        }
      )
    );
  }

  /**
   * Check if a document is a rumdl configuration file
   */
  private isConfigFile(document: vscode.TextDocument): boolean {
    const fileName = path.basename(document.fileName);
    return fileName === '.rumdl.toml' || fileName === 'rumdl.toml' || fileName === 'pyproject.toml';
  }

  /**
   * Check if pyproject.toml has a [tool.rumdl] section
   */
  private hasPyprojectRumdlSection(document: vscode.TextDocument): boolean {
    const text = document.getText();
    return text.includes('[tool.rumdl]') || text.includes('[tool.rumdl.');
  }

  /**
   * Validate all open configuration files
   */
  private validateOpenConfigFiles(): void {
    vscode.workspace.textDocuments.forEach(document => {
      if (this.isConfigFile(document)) {
        this.validateDocument(document);
      }
    });
  }

  /**
   * Debounced document validation
   */
  private validateDocumentDebounced(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    clearTimeout(this.pending.get(key));
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        this.validateDocument(document);
      }, 500)
    );
  }

  private clearDocument(uri: vscode.Uri): void {
    const key = uri.toString();
    clearTimeout(this.pending.get(key));
    this.pending.delete(key);
    this.diagnosticCollection.delete(uri);
  }

  /**
   * Validate a configuration document
   */
  private validateDocument(document: vscode.TextDocument): void {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const isPyproject = path.basename(document.fileName) === 'pyproject.toml';

    if (isPyproject && !this.hasPyprojectRumdlSection(document)) {
      this.diagnosticCollection.set(document.uri, []);
      return;
    }

    // Validate the original document text directly (no extraction/lineOffset)
    // so diagnostic line numbers always match what's on screen.
    const result = ConfigValidator.validateToml(text, isPyproject);

    // Convert validation errors to diagnostics
    for (const error of result.errors) {
      const line = error.line;
      const range = new vscode.Range(line, error.column, line, document.lineAt(line).text.length);

      const diagnostic = new vscode.Diagnostic(range, error.message, error.severity);
      diagnostic.source = 'rumdl';

      diagnostics.push(diagnostic);
    }

    // Set diagnostics
    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  dispose(): void {
    for (const timeout of this.pending.values()) {
      clearTimeout(timeout);
    }
    this.pending.clear();
    this.disposables.forEach(d => d.dispose());
  }
}

/**
 * Code action provider for configuration quick fixes
 */
class ConfigCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // Get diagnostics in the current range
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source === 'rumdl') {
        const fixes = ConfigValidator.getQuickFixes(document, diagnostic);
        actions.push(...fixes);
      }
    }

    return actions;
  }
}
