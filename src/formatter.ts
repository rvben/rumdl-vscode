import * as vscode from 'vscode';
import { Logger } from './utils';

/**
 * Rumdl Document Formatting Provider
 *
 * Implements VS Code's native format provider interface to enable:
 * - Format Document command
 * - Format on Save (via editor.formatOnSave)
 * - Format Selection
 */
export class RumdlFormattingProvider implements vscode.DocumentFormattingEditProvider {
  /**
   * Provide formatting edits for a document
   */
  public async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): Promise<vscode.TextEdit[]> {
    Logger.info(`Format document requested: ${document.uri.fsPath}`);

    if (document.languageId !== 'markdown') {
      Logger.warn('Format provider called on non-markdown document');
      return [];
    }

    try {
      // Get all code actions for the document (fixes)
      const range = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );

      const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        document.uri,
        range,
        vscode.CodeActionKind.QuickFix.value
      );

      if (!codeActions || codeActions.length === 0) {
        Logger.info('No fixes available for formatting');
        return [];
      }

      // Filter for rumdl fix actions
      const rumdlFixActions = codeActions.filter(
        action =>
          action.kind?.value.startsWith('quickfix.rumdl') ||
          action.title.toLowerCase().includes('rumdl')
      );

      if (rumdlFixActions.length === 0) {
        Logger.info('No rumdl fixes available for formatting');
        return [];
      }

      // Convert code actions to text edits
      const edits: vscode.TextEdit[] = [];

      for (const action of rumdlFixActions) {
        if (action.edit) {
          // Extract edits from the workspace edit
          const workspaceEdit = action.edit;
          const documentEdits = workspaceEdit.get(document.uri);

          if (documentEdits) {
            edits.push(...documentEdits);
          }
        }
      }

      Logger.info(`Format document: returning ${edits.length} edits`);
      return edits;
    } catch (error) {
      Logger.error('Error providing formatting edits', error as Error);
      return [];
    }
  }
}

/**
 * Register the formatting provider for Markdown documents
 */
export function registerFormattingProvider(context: vscode.ExtensionContext): vscode.Disposable {
  const provider = new RumdlFormattingProvider();

  const disposable = vscode.languages.registerDocumentFormattingEditProvider(
    { scheme: 'file', language: 'markdown' },
    provider
  );

  context.subscriptions.push(disposable);
  Logger.info('Rumdl formatting provider registered');

  return disposable;
}
