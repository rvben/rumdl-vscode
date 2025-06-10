import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import * as path from 'path';

// Mock types
export interface MockTextDocument {
  uri: { fsPath: string; scheme: string; toString: () => string };
  fileName: string;
  languageId: string;
  version: number;
  getText: (range?: any) => string;
  lineCount: number;
  lineAt: (line: number) => { text: string; range: any };
  positionAt: (offset: number) => { line: number; character: number };
  offsetAt: (position: { line: number; character: number }) => number;
  save: () => Promise<boolean>;
}

export interface MockWorkspaceFolder {
  uri: { fsPath: string; scheme: string };
  name: string;
  index: number;
}

// Create VS Code mock
export function createVSCodeMock() {
  const eventEmitters = new Map<string, EventEmitter>();
  
  function createEvent(name: string) {
    if (!eventEmitters.has(name)) {
      eventEmitters.set(name, new EventEmitter());
    }
    const emitter = eventEmitters.get(name)!;
    return (listener: Function) => {
      emitter.on(name, listener as any);
      return { dispose: () => emitter.off(name, listener as any) };
    };
  }

  const workspaceFolders: MockWorkspaceFolder[] = [];
  const mockDocuments = new Map<string, MockTextDocument>();
  const configuration = new Map<string, any>();
  const registeredCommands = new Map<string, Function>();
  
  const vscode = {
    workspace: {
      workspaceFolders,
      
      getWorkspaceFolder: sinon.stub().callsFake((uri: any) => {
        return workspaceFolders.find(f => uri.fsPath.startsWith(f.uri.fsPath));
      }),
      
      findFiles: sinon.stub().resolves([]),
      
      openTextDocument: sinon.stub().callsFake(async (uri: any) => {
        const fsPath = typeof uri === 'string' ? uri : uri.fsPath;
        if (mockDocuments.has(fsPath)) {
          return mockDocuments.get(fsPath);
        }
        const doc = createMockTextDocument(fsPath);
        mockDocuments.set(fsPath, doc);
        return doc;
      }),
      
      getConfiguration: sinon.stub().callsFake((section?: string) => {
        return {
          get: (key: string, defaultValue?: any) => {
            const fullKey = section ? `${section}.${key}` : key;
            return configuration.has(fullKey) ? configuration.get(fullKey) : defaultValue;
          },
          update: async (key: string, value: any) => {
            const fullKey = section ? `${section}.${key}` : key;
            configuration.set(fullKey, value);
          },
          has: (key: string) => {
            const fullKey = section ? `${section}.${key}` : key;
            return configuration.has(fullKey);
          }
        };
      }),
      
      onDidChangeConfiguration: Object.assign(createEvent('onDidChangeConfiguration'), sinon.stub()),
      onDidOpenTextDocument: Object.assign(createEvent('onDidOpenTextDocument'), sinon.stub()),
      onDidCloseTextDocument: Object.assign(createEvent('onDidCloseTextDocument'), sinon.stub()),
      onDidChangeTextDocument: Object.assign(createEvent('onDidChangeTextDocument'), sinon.stub()),
      onDidSaveTextDocument: Object.assign(createEvent('onDidSaveTextDocument'), sinon.stub()),
      
      applyEdit: sinon.stub().resolves(true),
    },
    
    window: {
      showInformationMessage: sinon.stub().resolves(),
      showWarningMessage: sinon.stub().resolves(),
      showErrorMessage: sinon.stub().resolves(),
      showQuickPick: sinon.stub().resolves(),
      showInputBox: sinon.stub().resolves(),
      
      createOutputChannel: sinon.stub().returns({
        append: sinon.stub(),
        appendLine: sinon.stub(),
        clear: sinon.stub(),
        show: sinon.stub(),
        hide: sinon.stub(),
        dispose: sinon.stub()
      }),
      
      createStatusBarItem: sinon.stub().returns({
        text: '',
        tooltip: '',
        command: undefined,
        show: sinon.stub(),
        hide: sinon.stub(),
        dispose: sinon.stub()
      }),
      
      setStatusBarMessage: sinon.stub().returns({ dispose: sinon.stub() }),
      
      withProgress: sinon.stub().callsFake(async (options: any, task: Function) => {
        const progress = {
          report: sinon.stub()
        };
        const token = {
          isCancellationRequested: false,
          onCancellationRequested: sinon.stub()
        };
        return await task(progress, token);
      }),
      
      createTextEditorDecorationType: sinon.stub().returns({
        dispose: sinon.stub()
      }),
      
      activeTextEditor: undefined,
      visibleTextEditors: []
    },
    
    commands: {
      registerCommand: sinon.stub().callsFake((command: string, callback: Function) => {
        registeredCommands.set(command, callback);
        return { dispose: () => registeredCommands.delete(command) };
      }),
      
      executeCommand: sinon.stub().callsFake(async (command: string, ...args: any[]) => {
        const handler = registeredCommands.get(command);
        if (handler) {
          return await handler(...args);
        }
        return undefined;
      }),
      
      getCommands: sinon.stub().resolves(Array.from(registeredCommands.keys()))
    },
    
    languages: {
      createDiagnosticCollection: sinon.stub().returns({
        name: 'test',
        set: sinon.stub(),
        delete: sinon.stub(),
        clear: sinon.stub(),
        dispose: sinon.stub(),
        forEach: sinon.stub(),
        get: sinon.stub(),
        has: sinon.stub()
      }),
      
      registerCodeActionsProvider: sinon.stub().returns({ dispose: sinon.stub() }),
      registerDefinitionProvider: sinon.stub().returns({ dispose: sinon.stub() }),
      registerHoverProvider: sinon.stub().returns({ dispose: sinon.stub() }),
      registerCompletionItemProvider: sinon.stub().returns({ dispose: sinon.stub() })
    },
    
    Uri: {
      file: (filePath: string) => ({
        fsPath: filePath,
        scheme: 'file',
        path: filePath,
        authority: '',
        query: '',
        fragment: '',
        with: function() { return this; },
        toJSON: function() { return { fsPath: this.fsPath, scheme: this.scheme }; },
        toString: () => `file://${filePath}`
      }),
      
      parse: (uri: string) => {
        const match = uri.match(/^file:\/\/(.+)$/);
        const fsPath = match ? match[1] : uri;
        return {
          fsPath,
          scheme: 'file',
          path: fsPath,
          authority: '',
          query: '',
          fragment: '',
          with: function() { return this; },
          toJSON: function() { return { fsPath: this.fsPath, scheme: this.scheme }; },
          toString: () => uri
        };
      }
    },
    
    Position: class {
      constructor(public line: number, public character: number) {}
    },
    
    Range: class {
      constructor(
        public start: { line: number; character: number },
        public end: { line: number; character: number }
      ) {}
    },
    
    Location: class {
      constructor(public uri: any, public range: any) {}
    },
    
    Diagnostic: class {
      constructor(
        public range: any,
        public message: string,
        public severity: number
      ) {
        this.source = 'rumdl';
      }
      source?: string;
      code?: string | number;
    },
    
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
      Hint: 3
    },
    
    CodeAction: class {
      constructor(public title: string, public kind?: any) {}
      command?: any;
      diagnostics?: any[];
      edit?: any;
      isPreferred?: boolean;
    },
    
    CodeActionKind: {
      QuickFix: { value: 'quickfix' },
      Refactor: { value: 'refactor' },
      RefactorExtract: { value: 'refactor.extract' },
      RefactorInline: { value: 'refactor.inline' },
      RefactorRewrite: { value: 'refactor.rewrite' },
      Source: { value: 'source' },
      SourceOrganizeImports: { value: 'source.organizeImports' }
    },
    
    WorkspaceEdit: class {
      private edits = new Map<string, any[]>();
      
      set(uri: any, edits: any[]) {
        this.edits.set(uri.toString(), edits);
      }
      
      get(uri: any) {
        return this.edits.get(uri.toString()) || [];
      }
      
      has(uri: any) {
        return this.edits.has(uri.toString());
      }
      
      entries() {
        return Array.from(this.edits.entries()).map(([uri, edits]) => [vscode.Uri.parse(uri), edits]);
      }
    },
    
    ProgressLocation: {
      Notification: 15,
      Window: 1,
      SourceControl: 2
    },
    
    StatusBarAlignment: {
      Left: 1,
      Right: 2
    },
    
    EndOfLine: {
      LF: 1,
      CRLF: 2
    },
    
    extensions: {
      getExtension: sinon.stub().returns({
        isActive: false,
        activate: sinon.stub().resolves(),
        exports: {}
      }),
      all: []
    },
    
    ExtensionContext: class {
      subscriptions: any[] = [];
      workspaceState = {
        get: sinon.stub(),
        update: sinon.stub().resolves()
      };
      globalState = {
        get: sinon.stub(),
        update: sinon.stub().resolves()
      };
      extensionPath = '/mock/extension/path';
      storagePath = '/mock/storage/path';
      globalStoragePath = '/mock/global/storage/path';
      logPath = '/mock/log/path';
    },
    
    ThemeColor: class {
      constructor(public id: string) {}
    }
  };
  
  return { vscode, eventEmitters, mockDocuments, configuration, registeredCommands };
}

export function createMockTextDocument(filePath: string, content = ''): MockTextDocument {
  const lines = content.split('\n');
  
  return {
    uri: {
      fsPath: filePath,
      scheme: 'file',
      toString: () => `file://${filePath}`
    },
    fileName: filePath,
    languageId: path.extname(filePath) === '.md' ? 'markdown' : 'plaintext',
    version: 1,
    getText: (range?: any) => {
      if (!range) return content;
      // Simplified range handling
      return content;
    },
    lineCount: lines.length,
    lineAt: (line: number) => ({
      text: lines[line] || '',
      range: {
        start: { line, character: 0 },
        end: { line, character: (lines[line] || '').length }
      }
    }),
    positionAt: (offset: number) => {
      let line = 0;
      let character = offset;
      for (let i = 0; i < lines.length; i++) {
        if (character <= lines[i].length) {
          line = i;
          break;
        }
        character -= lines[i].length + 1; // +1 for newline
      }
      return { line, character: Math.max(0, character) };
    },
    offsetAt: (position: { line: number; character: number }) => {
      let offset = 0;
      for (let i = 0; i < position.line && i < lines.length; i++) {
        offset += lines[i].length + 1; // +1 for newline
      }
      return offset + position.character;
    },
    save: sinon.stub().resolves(true)
  };
}

export function createMockWorkspaceFolder(name: string, fsPath: string): MockWorkspaceFolder {
  return {
    uri: { fsPath, scheme: 'file' },
    name,
    index: 0
  };
}

// Helper to setup VS Code for tests
export function setupVSCode() {
  const mock = createVSCodeMock();
  
  // Set up global vscode object
  (global as any).vscode = mock.vscode;
  
  return mock;
}

// Helper to clean up after tests
export function cleanupVSCode() {
  delete (global as any).vscode;
  sinon.restore();
}