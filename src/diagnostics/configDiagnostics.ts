import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigValidator } from '../configValidator';

/**
 * Diagnostic provider for rumdl configuration files
 */
export class ConfigDiagnosticProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
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
          this.diagnosticCollection.delete(document.uri);
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
    return (
      fileName === '.rumdl.toml' ||
      fileName === 'rumdl.toml' ||
      (fileName === 'pyproject.toml' && this.hasPyprojectRumdlSection(document))
    );
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
  private validateDocumentDebounced = this.debounce((document: unknown) => {
    this.validateDocument(document as vscode.TextDocument);
  }, 500);

  /**
   * Validate a configuration document
   */
  private validateDocument(document: vscode.TextDocument): void {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    // For pyproject.toml, extract the [tool.rumdl] section
    let contentToValidate = text;
    let lineOffset = 0;

    if (path.basename(document.fileName) === 'pyproject.toml') {
      const rumdlSection = this.extractRumdlSection(text);
      if (!rumdlSection) {
        this.diagnosticCollection.set(document.uri, []);
        return;
      }
      contentToValidate = rumdlSection.content;
      lineOffset = rumdlSection.startLine;
    }

    // Validate the content
    const result = ConfigValidator.validateToml(contentToValidate);

    // Convert validation errors to diagnostics
    for (const error of result.errors) {
      const line = error.line + lineOffset;
      const range = new vscode.Range(line, error.column, line, document.lineAt(line).text.length);

      const diagnostic = new vscode.Diagnostic(range, error.message, error.severity);
      diagnostic.source = 'rumdl';

      diagnostics.push(diagnostic);
    }

    // Set diagnostics
    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /**
   * Extract [tool.rumdl] section from pyproject.toml
   */
  private extractRumdlSection(text: string): { content: string; startLine: number } | null {
    const lines = text.split('\n');
    let inRumdlSection = false;
    const rumdlContent: string[] = [];
    let startLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for [tool.rumdl] section start
      if (trimmed === '[tool.rumdl]' || trimmed.startsWith('[tool.rumdl.')) {
        inRumdlSection = true;
        if (startLine === -1) {
          startLine = i;
        }

        // Convert [tool.rumdl.X] to [rules.X]
        if (trimmed.startsWith('[tool.rumdl.') && trimmed.endsWith(']')) {
          const converted = trimmed.replace('[tool.rumdl.', '[rules.');
          rumdlContent.push(converted);
        } else if (trimmed === '[tool.rumdl]') {
          rumdlContent.push('[rules]');
        }
        continue;
      }

      // Check for end of section
      if (inRumdlSection && trimmed.startsWith('[') && !trimmed.startsWith('[tool.rumdl')) {
        break;
      }

      // Add lines in the rumdl section
      if (inRumdlSection) {
        rumdlContent.push(line);
      }
    }

    if (rumdlContent.length === 0) {
      return null;
    }

    return {
      content: rumdlContent.join('\n'),
      startLine,
    };
  }

  /**
   * Debounce helper function
   */
  private debounce<T extends (...args: unknown[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  dispose(): void {
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
