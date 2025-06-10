import * as path from 'path';
import { 
  expect, 
  sinon, 
  beforeEachTest, 
  afterEachTest,
  createTestDocument,
  addWorkspaceFolder 
} from '../helper';
import { WorkspaceUtils } from '../../utils/workspace';

describe('WorkspaceUtils', () => {
  let vscodeContext: ReturnType<typeof beforeEachTest>;
  
  beforeEach(() => {
    vscodeContext = beforeEachTest();
  });
  
  afterEach(() => {
    afterEachTest();
  });
  
  describe('findMarkdownFiles', () => {
    it('should find markdown files with default pattern', async () => {
      const mockUris = [
        { fsPath: '/test/file1.md', scheme: 'file', toString: () => 'file:///test/file1.md' },
        { fsPath: '/test/file2.markdown', scheme: 'file', toString: () => 'file:///test/file2.markdown' },
        { fsPath: '/test/file3.mdx', scheme: 'file', toString: () => 'file:///test/file3.mdx' }
      ];
      
      vscodeContext.vscode.workspace.findFiles.resolves(mockUris);
      
      const files = await WorkspaceUtils.findMarkdownFiles();
      
      expect(files).to.deep.equal(mockUris);
      expect(vscodeContext.vscode.workspace.findFiles.calledOnce).to.be.true;
      expect(vscodeContext.vscode.workspace.findFiles.firstCall.args[0]).to.equal('**/*.{md,markdown,mdx,mdown,mkd}');
    });
    
    it('should use custom include pattern', async () => {
      const customPattern = '**/*.md';
      await WorkspaceUtils.findMarkdownFiles(customPattern);
      
      expect(vscodeContext.vscode.workspace.findFiles.firstCall.args[0]).to.equal(customPattern);
    });
    
    it('should apply default excludes', async () => {
      await WorkspaceUtils.findMarkdownFiles();
      
      const excludePattern = vscodeContext.vscode.workspace.findFiles.firstCall.args[1];
      expect(excludePattern).to.include('node_modules');
      expect(excludePattern).to.include('.git');
      expect(excludePattern).to.include('dist');
      expect(excludePattern).to.include('build');
    });
    
    it('should combine custom excludes with defaults', async () => {
      const customExclude = '**/custom/**';
      await WorkspaceUtils.findMarkdownFiles(undefined, customExclude);
      
      const excludePattern = vscodeContext.vscode.workspace.findFiles.firstCall.args[1];
      expect(excludePattern).to.include(customExclude);
      expect(excludePattern).to.include('node_modules');
    });
    
    it('should handle empty results', async () => {
      vscodeContext.vscode.workspace.findFiles.resolves([]);
      
      const files = await WorkspaceUtils.findMarkdownFiles();
      expect(files).to.deep.equal([]);
    });
  });
  
  describe('getWorkspaceFolders', () => {
    it('should return empty array when no workspace folders', () => {
      const folders = WorkspaceUtils.getWorkspaceFolders();
      expect(folders).to.deep.equal([]);
    });
    
    it('should return workspace folder paths', () => {
      addWorkspaceFolder('project1', '/path/to/project1');
      addWorkspaceFolder('project2', '/path/to/project2');
      
      const folders = WorkspaceUtils.getWorkspaceFolders();
      
      expect(folders).to.deep.equal([
        '/path/to/project1',
        '/path/to/project2'
      ]);
    });
  });
  
  describe('isInWorkspace', () => {
    it('should return false when no workspace folders', () => {
      const uri = vscodeContext.vscode.Uri.file('/some/file.md');
      expect(WorkspaceUtils.isInWorkspace(uri)).to.be.false;
    });
    
    it('should return true for files in workspace', () => {
      addWorkspaceFolder('project', '/workspace/project');
      
      const uri = vscodeContext.vscode.Uri.file('/workspace/project/src/file.md');
      expect(WorkspaceUtils.isInWorkspace(uri)).to.be.true;
    });
    
    it('should return false for files outside workspace', () => {
      addWorkspaceFolder('project', '/workspace/project');
      
      const uri = vscodeContext.vscode.Uri.file('/other/location/file.md');
      expect(WorkspaceUtils.isInWorkspace(uri)).to.be.false;
    });
    
    it('should handle multiple workspace folders', () => {
      addWorkspaceFolder('project1', '/workspace/project1');
      addWorkspaceFolder('project2', '/workspace/project2');
      
      const uri1 = vscodeContext.vscode.Uri.file('/workspace/project1/file.md');
      const uri2 = vscodeContext.vscode.Uri.file('/workspace/project2/file.md');
      const uri3 = vscodeContext.vscode.Uri.file('/other/file.md');
      
      expect(WorkspaceUtils.isInWorkspace(uri1)).to.be.true;
      expect(WorkspaceUtils.isInWorkspace(uri2)).to.be.true;
      expect(WorkspaceUtils.isInWorkspace(uri3)).to.be.false;
    });
  });
  
  describe('getRelativePath', () => {
    it('should return relative path for file in workspace', () => {
      const folder = addWorkspaceFolder('project', '/workspace/project');
      const uri = vscodeContext.vscode.Uri.file('/workspace/project/src/utils/file.md');
      
      vscodeContext.vscode.workspace.getWorkspaceFolder.returns(folder);
      
      const relativePath = WorkspaceUtils.getRelativePath(uri);
      expect(relativePath).to.equal(path.join('src', 'utils', 'file.md'));
    });
    
    it('should return absolute path for file outside workspace', () => {
      const uri = vscodeContext.vscode.Uri.file('/outside/file.md');
      vscodeContext.vscode.workspace.getWorkspaceFolder.returns(undefined);
      
      const relativePath = WorkspaceUtils.getRelativePath(uri);
      expect(relativePath).to.equal('/outside/file.md');
    });
  });
  
  describe('batchProcess', () => {
    it('should process files in batches', async () => {
      const files = [
        vscodeContext.vscode.Uri.file('/file1.md'),
        vscodeContext.vscode.Uri.file('/file2.md'),
        vscodeContext.vscode.Uri.file('/file3.md'),
        vscodeContext.vscode.Uri.file('/file4.md'),
        vscodeContext.vscode.Uri.file('/file5.md')
      ];
      
      const processor = sinon.stub().resolves('processed');
      const onProgress = sinon.stub();
      
      const results = await WorkspaceUtils.batchProcess(
        files,
        2, // batch size
        processor,
        onProgress
      );
      
      expect(results).to.have.length(5);
      expect(results.every(r => r === 'processed')).to.be.true;
      expect(processor.callCount).to.equal(5);
      
      // Check progress reporting
      expect(onProgress.callCount).to.equal(3); // 3 batches: 2+2+1
      expect(onProgress.firstCall.args).to.deep.equal([2, 5]);
      expect(onProgress.secondCall.args).to.deep.equal([4, 5]);
      expect(onProgress.thirdCall.args).to.deep.equal([5, 5]);
    });
    
    it('should handle empty file list', async () => {
      const processor = sinon.stub();
      const results = await WorkspaceUtils.batchProcess([], 10, processor);
      
      expect(results).to.deep.equal([]);
      expect(processor.called).to.be.false;
    });
    
    it('should handle processor errors', async () => {
      const files = [
        vscodeContext.vscode.Uri.file('/file1.md'),
        vscodeContext.vscode.Uri.file('/file2.md')
      ];
      
      const processor = sinon.stub();
      processor.onFirstCall().resolves('ok');
      processor.onSecondCall().rejects(new Error('Processing failed'));
      
      try {
        await WorkspaceUtils.batchProcess(files, 2, processor);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).to.equal('Processing failed');
      }
    });
    
    it('should work without progress callback', async () => {
      const files = [vscodeContext.vscode.Uri.file('/file1.md')];
      const processor = sinon.stub().resolves('done');
      
      const results = await WorkspaceUtils.batchProcess(files, 1, processor);
      
      expect(results).to.deep.equal(['done']);
    });
  });
  
  describe('getLineCount', () => {
    it('should return correct line count', () => {
      const doc = createTestDocument('line1\nline2\nline3');
      const count = WorkspaceUtils.getLineCount(doc as any);
      expect(count).to.equal(3);
    });
    
    it('should handle empty document', () => {
      const doc = createTestDocument('');
      const count = WorkspaceUtils.getLineCount(doc as any);
      expect(count).to.equal(1); // Empty doc has 1 line
    });
  });
  
  describe('estimateProcessingTime', () => {
    it('should use default time per file', () => {
      const time = WorkspaceUtils.estimateProcessingTime(10);
      expect(time).to.equal(1000); // 10 files * 100ms default
    });
    
    it('should use custom time per file', () => {
      const time = WorkspaceUtils.estimateProcessingTime(5, 200);
      expect(time).to.equal(1000); // 5 files * 200ms
    });
    
    it('should handle zero files', () => {
      const time = WorkspaceUtils.estimateProcessingTime(0);
      expect(time).to.equal(0);
    });
  });
  
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(WorkspaceUtils.formatFileSize(0)).to.equal('0.0 B');
      expect(WorkspaceUtils.formatFileSize(512)).to.equal('512.0 B');
      expect(WorkspaceUtils.formatFileSize(1023)).to.equal('1023.0 B');
    });
    
    it('should format kilobytes correctly', () => {
      expect(WorkspaceUtils.formatFileSize(1024)).to.equal('1.0 KB');
      expect(WorkspaceUtils.formatFileSize(1536)).to.equal('1.5 KB');
      expect(WorkspaceUtils.formatFileSize(1048575)).to.equal('1024.0 KB');
    });
    
    it('should format megabytes correctly', () => {
      expect(WorkspaceUtils.formatFileSize(1048576)).to.equal('1.0 MB');
      expect(WorkspaceUtils.formatFileSize(1572864)).to.equal('1.5 MB');
      expect(WorkspaceUtils.formatFileSize(1073741823)).to.equal('1024.0 MB');
    });
    
    it('should format gigabytes correctly', () => {
      expect(WorkspaceUtils.formatFileSize(1073741824)).to.equal('1.0 GB');
      expect(WorkspaceUtils.formatFileSize(1610612736)).to.equal('1.5 GB');
      expect(WorkspaceUtils.formatFileSize(10737418240)).to.equal('10.0 GB');
    });
  });
});