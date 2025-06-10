import { 
  expect, 
  sinon,
  beforeEachTest, 
  afterEachTest 
} from '../helper';
import { StatusBarManager, ServerStatus } from '../../statusBar';
import * as utils from '../../utils';

describe('StatusBarManager', () => {
  let vscodeContext: ReturnType<typeof beforeEachTest>;
  let statusBarManager: StatusBarManager;
  let mockStatusBarItem: any;
  let loggerStub: sinon.SinonStub;
  
  beforeEach(() => {
    vscodeContext = beforeEachTest();
    
    // Create a more complete mock status bar item
    mockStatusBarItem = {
      text: '',
      tooltip: '',
      command: undefined,
      backgroundColor: undefined,
      show: sinon.stub(),
      hide: sinon.stub(),
      dispose: sinon.stub()
    };
    
    // Override createStatusBarItem to return our mock
    vscodeContext.vscode.window.createStatusBarItem = sinon.stub().returns(mockStatusBarItem);
    
    // Stub Logger
    loggerStub = sinon.stub(utils.Logger, 'info');
    
    statusBarManager = new StatusBarManager();
  });
  
  afterEach(() => {
    sinon.restore();
    afterEachTest();
  });
  
  describe('constructor', () => {
    it('should create status bar item with correct settings', () => {
      expect(vscodeContext.vscode.window.createStatusBarItem.calledOnce).to.be.true;
      expect(vscodeContext.vscode.window.createStatusBarItem.firstCall.args).to.deep.equal([
        vscodeContext.vscode.StatusBarAlignment.Right,
        100
      ]);
      expect(mockStatusBarItem.command).to.equal('rumdl.showClientLogs');
    });
    
    it('should initialize with disconnected status', () => {
      expect(mockStatusBarItem.text).to.equal('$(circle-slash) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('rumdl server is not running');
    });
  });
  
  describe('setStatus', () => {
    it('should update status and log change', () => {
      statusBarManager.setStatus(ServerStatus.Connected, 'Test message');
      
      expect(mockStatusBarItem.text).to.equal('$(check) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('Test message');
      expect(loggerStub.calledWith('Status changed to: connected - Test message')).to.be.true;
    });
    
    it('should handle status without message', () => {
      statusBarManager.setStatus(ServerStatus.Error);
      
      expect(mockStatusBarItem.text).to.equal('$(error) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('rumdl server error');
      expect(loggerStub.calledWith('Status changed to: error')).to.be.true;
    });
  });
  
  describe('setStarting', () => {
    it('should set starting status with spinner', () => {
      statusBarManager.setStarting();
      
      expect(mockStatusBarItem.text).to.equal('$(loading~spin) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('Starting rumdl server...');
      expect(mockStatusBarItem.backgroundColor).to.be.undefined;
    });
  });
  
  describe('setConnected', () => {
    it('should set connected status without rule count', () => {
      statusBarManager.setConnected();
      
      expect(mockStatusBarItem.text).to.equal('$(check) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('Connected');
      expect(mockStatusBarItem.backgroundColor).to.be.undefined;
    });
    
    it('should set connected status with rule count', () => {
      statusBarManager.setConnected(42);
      
      expect(mockStatusBarItem.text).to.equal('$(check) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('42 rules active');
    });
  });
  
  describe('setDisconnected', () => {
    it('should set disconnected status with default message', () => {
      statusBarManager.setDisconnected();
      
      expect(mockStatusBarItem.text).to.equal('$(circle-slash) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('Disconnected');
      expect(mockStatusBarItem.backgroundColor).to.be.instanceOf(vscodeContext.vscode.ThemeColor);
      expect(mockStatusBarItem.backgroundColor.id).to.equal('statusBarItem.warningBackground');
    });
    
    it('should set disconnected status with custom reason', () => {
      statusBarManager.setDisconnected('Server stopped');
      
      expect(mockStatusBarItem.text).to.equal('$(circle-slash) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('Server stopped');
    });
  });
  
  describe('setError', () => {
    it('should set error status', () => {
      statusBarManager.setError('Connection failed');
      
      expect(mockStatusBarItem.text).to.equal('$(error) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('Connection failed');
      expect(mockStatusBarItem.backgroundColor).to.be.instanceOf(vscodeContext.vscode.ThemeColor);
      expect(mockStatusBarItem.backgroundColor.id).to.equal('statusBarItem.errorBackground');
    });
  });
  
  describe('status transitions', () => {
    it('should handle status transitions correctly', () => {
      // Starting -> Connected
      statusBarManager.setStarting();
      expect(mockStatusBarItem.text).to.equal('$(loading~spin) rumdl');
      
      statusBarManager.setConnected(25);
      expect(mockStatusBarItem.text).to.equal('$(check) rumdl');
      expect(mockStatusBarItem.tooltip).to.equal('25 rules active');
      
      // Connected -> Error
      statusBarManager.setError('Lost connection');
      expect(mockStatusBarItem.text).to.equal('$(error) rumdl');
      expect(mockStatusBarItem.backgroundColor.id).to.equal('statusBarItem.errorBackground');
      
      // Error -> Disconnected
      statusBarManager.setDisconnected('Manually stopped');
      expect(mockStatusBarItem.text).to.equal('$(circle-slash) rumdl');
      expect(mockStatusBarItem.backgroundColor.id).to.equal('statusBarItem.warningBackground');
    });
  });
  
  describe('show', () => {
    it('should show the status bar item', () => {
      statusBarManager.show();
      
      expect(mockStatusBarItem.show.calledOnce).to.be.true;
    });
  });
  
  describe('hide', () => {
    it('should hide the status bar item', () => {
      statusBarManager.hide();
      
      expect(mockStatusBarItem.hide.calledOnce).to.be.true;
    });
  });
  
  describe('dispose', () => {
    it('should dispose the status bar item', () => {
      statusBarManager.dispose();
      
      expect(mockStatusBarItem.dispose.calledOnce).to.be.true;
    });
  });
  
  describe('ThemeColor', () => {
    it('should create ThemeColor instances correctly', () => {
      // Need to make sure our mock ThemeColor works properly
      const ThemeColor = vscodeContext.vscode.ThemeColor;
      const warningColor = new ThemeColor('statusBarItem.warningBackground');
      const errorColor = new ThemeColor('statusBarItem.errorBackground');
      
      expect(warningColor.id).to.equal('statusBarItem.warningBackground');
      expect(errorColor.id).to.equal('statusBarItem.errorBackground');
    });
  });
});