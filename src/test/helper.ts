import * as vscode from 'vscode';
import * as path from 'path';
import { expect } from 'chai';
import { RumdlLanguageClient } from '../client';

export { expect };

const EXTENSION_ID = 'rvben.rumdl';

export async function activateExtension() {
  // Ensure rumdl is enabled in settings
  const config = vscode.workspace.getConfiguration('rumdl');
  await config.update('enable', true, vscode.ConfigurationTarget.Global);

  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  if (!extension) {
    throw new Error(`Extension ${EXTENSION_ID} not found`);
  }

  if (!extension.isActive) {
    await extension.activate();
  }

  // Wait for the language server to start
  await waitForLanguageServer();

  return extension;
}

export async function waitForLanguageServer(timeout = 10000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Check if we have any language clients
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    if (extension && extension.isActive) {
      // Try to get the client from the extension's exports
      const client = getLanguageClient();
      if (client && client.isRunning()) {
        console.log('Language server is running');
        return;
      }
    }

    await sleep(500);
  }

  console.warn('Language server did not start within timeout');
}

export function getLanguageClient(): RumdlLanguageClient | undefined {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  if (extension && extension.isActive && extension.exports) {
    return extension.exports.client;
  }
  return undefined;
}

export function getDocumentPath(fileName: string): string {
  return path.resolve(__dirname, '../../src/testFixture', fileName);
}

export function getDocumentUri(fileName: string): vscode.Uri {
  return vscode.Uri.file(getDocumentPath(fileName));
}

export async function openDocument(fileName: string): Promise<vscode.TextDocument> {
  const uri = getDocumentUri(fileName);
  return await vscode.workspace.openTextDocument(uri);
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export async function waitForDiagnostics(
  uri: vscode.Uri,
  timeout = 5000
): Promise<vscode.Diagnostic[]> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    if (diagnostics.length > 0) {
      return diagnostics;
    }
    await sleep(100);
  }

  return [];
}

export async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}
