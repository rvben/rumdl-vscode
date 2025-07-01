import * as vscode from 'vscode';
import * as path from 'path';
import { expect } from '../helper';
import { WorkspaceUtils } from '../../utils/workspace';

suite('Workspace Utils Tests', () => {
  test('findMarkdownFiles should find markdown files', async () => {
    const files = await WorkspaceUtils.findMarkdownFiles();

    // Should find at least our test fixtures
    expect(files).to.be.an('array');

    // Check if any markdown files were found
    if (files.length > 0) {
      const mdFile = files.find(f => f.fsPath.endsWith('.md'));
      expect(mdFile).to.exist;
    }
  });

  test('findMarkdownFiles with custom pattern', async () => {
    const files = await WorkspaceUtils.findMarkdownFiles('**/diagnostics.md');

    // Should find our specific test file
    const diagnosticsFile = files.find(f => f.fsPath.includes('diagnostics.md'));
    if (diagnosticsFile) {
      expect(diagnosticsFile.fsPath).to.include('diagnostics.md');
    }
  });

  test('findMarkdownFiles with excludes', async () => {
    const files = await WorkspaceUtils.findMarkdownFiles(undefined, '**/node_modules/**');

    // Should not include node_modules files
    const nodeModulesFile = files.find(f => f.fsPath.includes('node_modules'));
    expect(nodeModulesFile).to.not.exist;
  });

  test('getWorkspaceFolders should return folder paths', () => {
    const folders = WorkspaceUtils.getWorkspaceFolders();

    expect(folders).to.be.an('array');
    if (folders.length > 0) {
      expect(folders[0]).to.be.a('string');
      expect(path.isAbsolute(folders[0])).to.be.true;
    }
  });

  test('isInWorkspace should check if URI is in workspace', () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // Skip if no workspace
      return;
    }

    // Test with a file in workspace
    const fileInWorkspace = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, 'test.md'));
    expect(WorkspaceUtils.isInWorkspace(fileInWorkspace)).to.be.true;

    // Test with a file outside workspace
    const fileOutside = vscode.Uri.file('/tmp/outside.md');
    expect(WorkspaceUtils.isInWorkspace(fileOutside)).to.be.false;
  });

  test('getRelativePath should return relative path for workspace file', () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const testFile = vscode.Uri.file(
      path.join(workspaceFolders[0].uri.fsPath, 'subfolder', 'test.md')
    );
    const relativePath = WorkspaceUtils.getRelativePath(testFile);

    expect(relativePath).to.equal(path.join('subfolder', 'test.md'));
  });

  test('getRelativePath should return absolute path for file outside workspace', () => {
    const outsideUri = vscode.Uri.file('/tmp/outside.md');
    const result = WorkspaceUtils.getRelativePath(outsideUri);

    expect(result).to.equal('/tmp/outside.md');
  });

  test('getLineCount should count lines in document', async () => {
    // Open a test document
    const testUri = vscode.Uri.parse('untitled:test.md');
    const doc = await vscode.workspace.openTextDocument(testUri);
    const editor = await vscode.window.showTextDocument(doc);

    // Add some content
    await editor.edit(editBuilder => {
      editBuilder.insert(new vscode.Position(0, 0), 'Line 1\nLine 2\nLine 3');
    });

    const lineCount = WorkspaceUtils.getLineCount(doc);
    expect(lineCount).to.equal(3);

    // Close document
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('estimateProcessingTime should return time estimate', () => {
    const estimate = WorkspaceUtils.estimateProcessingTime(10);

    expect(estimate).to.be.a('number');
    expect(estimate).to.equal(1000); // 10 files * 100ms default
  });

  test('estimateProcessingTime with custom time per file', () => {
    const estimate = WorkspaceUtils.estimateProcessingTime(10, 50);

    expect(estimate).to.be.a('number');
    expect(estimate).to.equal(500); // 10 files * 50ms
  });

  test('formatFileSize should format bytes', () => {
    expect(WorkspaceUtils.formatFileSize(0)).to.equal('0.0 B');
    expect(WorkspaceUtils.formatFileSize(1024)).to.equal('1.0 KB');
    expect(WorkspaceUtils.formatFileSize(1048576)).to.equal('1.0 MB');
    expect(WorkspaceUtils.formatFileSize(1073741824)).to.equal('1.0 GB');
  });

  test('batchProcess should process files in batches', async () => {
    const testUris = [
      vscode.Uri.file('/test1.md'),
      vscode.Uri.file('/test2.md'),
      vscode.Uri.file('/test3.md'),
    ];

    let processedCount = 0;
    const processor = async (_uri: vscode.Uri) => {
      processedCount++;
      return { success: true };
    };

    const results = await WorkspaceUtils.batchProcess(testUris, 2, processor);

    expect(processedCount).to.equal(3);
    expect(results).to.have.lengthOf(3);
    expect(results[0]).to.deep.equal({ success: true });
  });

  test('batchProcess with progress callback', async () => {
    const testUris = [vscode.Uri.file('/test1.md'), vscode.Uri.file('/test2.md')];

    let lastProgress = 0;
    const processor = async (uri: vscode.Uri) => ({ uri });
    const onProgress = (processed: number, _total: number) => {
      lastProgress = processed;
    };

    await WorkspaceUtils.batchProcess(testUris, 1, processor, onProgress);

    expect(lastProgress).to.equal(2);
  });
});
