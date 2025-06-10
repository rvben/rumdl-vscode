import { 
  expect, 
  sinon,
  beforeEachTest, 
  afterEachTest,
  createTestDocument,
  expectInfo,
  expectError
} from '../helper';
import { CommandManager } from '../../commands';
import { RumdlLanguageClient } from '../../client';

describe('CommandManager', () => {
  let vscodeContext: ReturnType<typeof beforeEachTest>;
  let commandManager: CommandManager;
  let mockClient: any;
  let mockContext: any;
  
  beforeEach(() => {
    vscodeContext = beforeEachTest();
    
    // Create mock client
    mockClient = {
      isRunning: sinon.stub().returns(true),
      restart: sinon.stub().resolves(),
      getOutputChannel: sinon.stub().returns({
        show: sinon.stub()
      }),
      getTrace: sinon.stub().returns({
        show: sinon.stub()
      })
    };
    
    // Create mock extension context
    mockContext = {
      subscriptions: []
    };
    
    commandManager = new CommandManager(mockClient as any);
  });
  
  afterEach(() => {
    afterEachTest();
  });
  
  describe('register', () => {
    it('should register all commands', () => {
      commandManager.register(mockContext);
      
      const registeredCommands = Array.from(vscodeContext.registeredCommands.keys());
      
      expect(registeredCommands).to.include('rumdl.fixAll');
      expect(registeredCommands).to.include('rumdl.fixAllWorkspace');
      expect(registeredCommands).to.include('rumdl.restartServer');
      expect(registeredCommands).to.include('rumdl.showClientLogs');
      expect(registeredCommands).to.include('rumdl.showServerLogs');
      expect(registeredCommands).to.include('rumdl.printDebugInfo');
      expect(registeredCommands).to.include('rumdl.checkDuplicateDiagnostics');
      expect(registeredCommands).to.include('rumdl.checkStatus');
      expect(registeredCommands).to.include('rumdl.testConfigDiscovery');
      
      expect(mockContext.subscriptions).to.have.lengthOf(9);
    });
  });
  
  describe('fixAll', () => {
    beforeEach(() => {
      commandManager.register(mockContext);
    });
    
    it('should show error when no active editor', async () => {
      vscodeContext.vscode.window.activeTextEditor = undefined;
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.fixAll');
      
      expectError('No active editor found');
    });
    
    it('should show error when document is not markdown', async () => {
      const doc = createTestDocument('test content', 'test.js');
      vscodeContext.vscode.window.activeTextEditor = {
        document: doc
      } as any;
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.fixAll');
      
      expectError('Current file is not a Markdown file');
    });
    
    it('should show error when server is not running', async () => {
      const doc = createTestDocument('# Test', 'test.md');
      vscodeContext.vscode.window.activeTextEditor = {
        document: doc
      } as any;
      mockClient.isRunning.returns(false);
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.fixAll');
      
      expectError('rumdl server is not running');
    });
    
    it('should apply all available fixes', async () => {
      const doc = createTestDocument('# Test\n\n\n## Section', 'test.md');
      vscodeContext.vscode.window.activeTextEditor = {
        document: doc
      } as any;
      
      // Mock code actions
      const mockCodeActions = [
        {
          title: 'Fix rumdl MD012',
          kind: { value: 'quickfix.rumdl.MD012' },
          edit: { entries: () => [] }
        },
        {
          title: 'Fix rumdl MD022',
          kind: { value: 'quickfix.rumdl.MD022' },
          edit: { entries: () => [] }
        },
        {
          title: 'Other fix',
          kind: { value: 'quickfix.other' },
          edit: { entries: () => [] }
        }
      ];
      
      // Override executeCommand to return our mock actions
      const originalExecuteCommand = vscodeContext.vscode.commands.executeCommand;
      vscodeContext.vscode.commands.executeCommand = sinon.stub().callsFake(async (cmd, ...args) => {
        if (cmd === 'vscode.executeCodeActionProvider') {
          return mockCodeActions;
        }
        return originalExecuteCommand.call(vscodeContext.vscode.commands, cmd, ...args);
      });
      
      vscodeContext.vscode.workspace.applyEdit = sinon.stub().resolves(true);
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.fixAll');
      
      expect(vscodeContext.vscode.workspace.applyEdit.callCount).to.equal(2);
      expectInfo('Fixed 2 issues');
    });
    
    it('should handle no available fixes', async () => {
      const doc = createTestDocument('# Perfect document', 'test.md');
      vscodeContext.vscode.window.activeTextEditor = {
        document: doc
      } as any;
      
      const originalExecuteCommand = vscodeContext.vscode.commands.executeCommand;
      vscodeContext.vscode.commands.executeCommand = sinon.stub().callsFake(async (cmd, ...args) => {
        if (cmd === 'vscode.executeCodeActionProvider') {
          return [];
        }
        return originalExecuteCommand.call(vscodeContext.vscode.commands, cmd, ...args);
      });
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.fixAll');
      
      expectInfo('No auto-fixable issues found');
    });
  });
  
  describe('fixAllWorkspace', () => {
    beforeEach(() => {
      commandManager.register(mockContext);
    });
    
    it('should fix all markdown files in workspace', async () => {
      const mockFiles = [
        vscodeContext.vscode.Uri.file('/workspace/file1.md'),
        vscodeContext.vscode.Uri.file('/workspace/file2.md'),
        vscodeContext.vscode.Uri.file('/workspace/docs/file3.md')
      ];
      
      vscodeContext.vscode.workspace.findFiles.resolves(mockFiles);
      vscodeContext.vscode.workspace.openTextDocument.resolves(createTestDocument('# Test'));
      
      const originalExecuteCommand = vscodeContext.vscode.commands.executeCommand;
      vscodeContext.vscode.commands.executeCommand = sinon.stub().callsFake(async (cmd, ...args) => {
        if (cmd === 'vscode.executeCodeActionProvider') {
          return [{
            title: 'Fix rumdl issue',
            kind: { value: 'quickfix.rumdl' },
            edit: { entries: () => [] }
          }];
        }
        return originalExecuteCommand.call(vscodeContext.vscode.commands, cmd, ...args);
      });
      
      vscodeContext.vscode.workspace.applyEdit = sinon.stub().resolves(true);
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.fixAllWorkspace');
      
      expect(vscodeContext.vscode.workspace.findFiles.calledOnce).to.be.true;
      expect(vscodeContext.vscode.workspace.openTextDocument.callCount).to.equal(3);
      expectInfo();
    });
    
    it('should handle errors during processing', async () => {
      vscodeContext.vscode.workspace.findFiles.resolves([
        vscodeContext.vscode.Uri.file('/workspace/file1.md')
      ]);
      vscodeContext.vscode.workspace.openTextDocument.rejects(new Error('File not found'));
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.fixAllWorkspace');
      
      expectError('Failed to process 1 file. Check logs for details.');
    });
  });
  
  describe('restartServer', () => {
    beforeEach(() => {
      commandManager.register(mockContext);
    });
    
    it('should restart the server successfully', async () => {
      await vscodeContext.vscode.commands.executeCommand('rumdl.restartServer');
      
      expect(mockClient.restart.calledOnce).to.be.true;
      expectInfo('rumdl server restarted');
    });
    
    it('should handle restart errors', async () => {
      mockClient.restart.rejects(new Error('Failed to restart'));
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.restartServer');
      
      expectError('Failed to restart server: Failed to restart');
    });
  });
  
  describe('showClientLogs', () => {
    beforeEach(() => {
      commandManager.register(mockContext);
    });
    
    it('should show client output channel', async () => {
      const mockChannel = {
        show: sinon.stub()
      };
      mockClient.getOutputChannel.returns(mockChannel);
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.showClientLogs');
      
      expect(mockChannel.show.calledOnce).to.be.true;
    });
  });
  
  describe('showServerLogs', () => {
    beforeEach(() => {
      commandManager.register(mockContext);
    });
    
    it('should show server trace channel', async () => {
      const mockTrace = {
        show: sinon.stub()
      };
      mockClient.getTrace.returns(mockTrace);
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.showServerLogs');
      
      expect(mockTrace.show.calledOnce).to.be.true;
    });
  });
  
  describe('checkStatus', () => {
    beforeEach(() => {
      commandManager.register(mockContext);
    });
    
    it('should show status when server is running', async () => {
      mockClient.isRunning.returns(true);
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.checkStatus');
      
      expectInfo('rumdl extension is active and server is running');
    });
    
    it('should show status when server is not running', async () => {
      mockClient.isRunning.returns(false);
      
      await vscodeContext.vscode.commands.executeCommand('rumdl.checkStatus');
      
      expectInfo('rumdl extension is active but server is not running');
    });
  });
  
  describe('dispose', () => {
    it('should dispose all command registrations', () => {
      commandManager.register(mockContext);
      
      const disposeSpy = sinon.spy();
      commandManager['disposables'].forEach(d => {
        d.dispose = disposeSpy;
      });
      
      commandManager.dispose();
      
      expect(disposeSpy.callCount).to.equal(9);
    });
  });
});