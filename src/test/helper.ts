import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupVSCode, cleanupVSCode, createMockTextDocument, createMockWorkspaceFolder } from './mocks/vscode';

// Export test utilities
export { expect, sinon };
export { setupVSCode, cleanupVSCode, createMockTextDocument, createMockWorkspaceFolder };

// Global test setup
let vscodeContext: ReturnType<typeof setupVSCode>;

export function beforeEachTest() {
  vscodeContext = setupVSCode();
  return vscodeContext;
}

export function afterEachTest() {
  cleanupVSCode();
}

// Common test utilities
export function createTestDocument(content: string, fileName = 'test.md') {
  const doc = createMockTextDocument(`/test/${fileName}`, content);
  vscodeContext.mockDocuments.set(doc.uri.fsPath, doc);
  return doc;
}

export function setConfiguration(key: string, value: any) {
  vscodeContext.configuration.set(key, value);
}

export function addWorkspaceFolder(name: string, path: string) {
  const folder = createMockWorkspaceFolder(name, path);
  vscodeContext.vscode.workspace.workspaceFolders.push(folder);
  return folder;
}

export async function executeCommand(command: string, ...args: any[]) {
  return await vscodeContext.vscode.commands.executeCommand(command, ...args);
}

export function getRegisteredCommands() {
  return Array.from(vscodeContext.registeredCommands.keys());
}

// Assertion helpers
export function expectCommand(command: string) {
  expect(getRegisteredCommands()).to.include(command);
}

export function expectNoErrors() {
  expect(vscodeContext.vscode.window.showErrorMessage.called).to.be.false;
}

export function expectError(message?: string) {
  expect(vscodeContext.vscode.window.showErrorMessage.called).to.be.true;
  if (message) {
    expect(vscodeContext.vscode.window.showErrorMessage.calledWith(message)).to.be.true;
  }
}

export function expectInfo(message?: string) {
  expect(vscodeContext.vscode.window.showInformationMessage.called).to.be.true;
  if (message) {
    expect(vscodeContext.vscode.window.showInformationMessage.calledWith(message)).to.be.true;
  }
}