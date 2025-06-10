import { 
  expect, 
  sinon,
  beforeEachTest, 
  afterEachTest,
  setConfiguration
} from '../helper';
import { ConfigurationManager } from '../../configuration';
import * as utils from '../../utils';

describe('ConfigurationManager', () => {
  let vscodeContext: ReturnType<typeof beforeEachTest>;
  let loggerDebugStub: sinon.SinonStub;
  
  beforeEach(() => {
    vscodeContext = beforeEachTest();
    loggerDebugStub = sinon.stub(utils.Logger, 'debug');
  });
  
  afterEach(() => {
    sinon.restore();
    afterEachTest();
  });
  
  describe('getConfiguration', () => {
    it('should return default configuration', () => {
      const config = ConfigurationManager.getConfiguration();
      
      expect(config).to.deep.equal({
        enable: true,
        configPath: undefined,
        rules: {
          select: [],
          ignore: []
        },
        server: {
          path: 'rumdl',
          logLevel: 'info'
        },
        trace: {
          server: 'off'
        },
        diagnostics: {
          deduplicate: true
        }
      });
    });
    
    it('should return custom configuration', () => {
      setConfiguration('rumdl.enable', false);
      setConfiguration('rumdl.configPath', '/path/to/config.toml');
      setConfiguration('rumdl.rules.select', ['MD001', 'MD002']);
      setConfiguration('rumdl.rules.ignore', ['MD003']);
      setConfiguration('rumdl.server.path', '/custom/rumdl');
      setConfiguration('rumdl.server.logLevel', 'debug');
      setConfiguration('rumdl.trace.server', 'verbose');
      setConfiguration('rumdl.diagnostics.deduplicate', false);
      
      const config = ConfigurationManager.getConfiguration();
      
      expect(config).to.deep.equal({
        enable: false,
        configPath: '/path/to/config.toml',
        rules: {
          select: ['MD001', 'MD002'],
          ignore: ['MD003']
        },
        server: {
          path: '/custom/rumdl',
          logLevel: 'debug'
        },
        trace: {
          server: 'verbose'
        },
        diagnostics: {
          deduplicate: false
        }
      });
    });
    
    it('should handle missing configuration values', () => {
      // Simulate getConfiguration returning undefined for some values
      const originalGetConfiguration = vscodeContext.vscode.workspace.getConfiguration;
      vscodeContext.vscode.workspace.getConfiguration = sinon.stub().returns({
        get: (key: string, defaultValue?: any) => {
          if (key === 'configPath') return undefined;
          if (key === 'rules.select') return undefined;
          return defaultValue;
        },
        update: sinon.stub(),
        has: sinon.stub()
      });
      
      const config = ConfigurationManager.getConfiguration();
      
      expect(config.configPath).to.be.undefined;
      expect(config.rules.select).to.deep.equal([]);
      
      vscodeContext.vscode.workspace.getConfiguration = originalGetConfiguration;
    });
  });
  
  describe('onConfigurationChanged', () => {
    it('should register configuration change listener', () => {
      const callback = sinon.stub();
      
      const disposable = ConfigurationManager.onConfigurationChanged(callback);
      
      expect(vscodeContext.eventEmitters.has('onDidChangeConfiguration')).to.be.true;
      expect(disposable).to.exist;
    });
    
    it('should call callback when rumdl configuration changes', () => {
      const callback = sinon.stub();
      ConfigurationManager.onConfigurationChanged(callback);
      
      // Trigger the event
      const emitter = vscodeContext.eventEmitters.get('onDidChangeConfiguration');
      expect(emitter).to.exist;
      
      // Simulate configuration change event affecting rumdl
      const event = {
        affectsConfiguration: sinon.stub().returns(true)
      };
      
      emitter!.emit('onDidChangeConfiguration', event);
      
      expect(event.affectsConfiguration.calledWith('rumdl')).to.be.true;
      expect(callback.calledOnce).to.be.true;
      expect(callback.firstCall.args[0]).to.have.property('enable');
    });
    
    it('should not call callback for unrelated configuration changes', () => {
      const callback = sinon.stub();
      ConfigurationManager.onConfigurationChanged(callback);
      
      const emitter = vscodeContext.eventEmitters.get('onDidChangeConfiguration');
      expect(emitter).to.exist;
      
      const event = {
        affectsConfiguration: sinon.stub().returns(false)
      };
      
      emitter!.emit('onDidChangeConfiguration', event);
      
      expect(callback.called).to.be.false;
    });
  });
  
  describe('isEnabled', () => {
    it('should return true by default', () => {
      expect(ConfigurationManager.isEnabled()).to.be.true;
    });
    
    it('should return false when disabled', () => {
      setConfiguration('rumdl.enable', false);
      expect(ConfigurationManager.isEnabled()).to.be.false;
    });
  });
  
  describe('getRumdlPath', () => {
    it('should return default rumdl path', () => {
      const path = ConfigurationManager.getRumdlPath();
      
      expect(path).to.equal('rumdl');
      expect(loggerDebugStub.calledWith('getRumdlPath: config value="rumdl", final value="rumdl"')).to.be.true;
    });
    
    it('should return configured path', () => {
      setConfiguration('rumdl.server.path', '/usr/local/bin/rumdl');
      
      const path = ConfigurationManager.getRumdlPath();
      
      expect(path).to.equal('/usr/local/bin/rumdl');
    });
    
    it('should handle empty string', () => {
      setConfiguration('rumdl.server.path', '');
      
      const path = ConfigurationManager.getRumdlPath();
      
      expect(path).to.equal('rumdl');
      expect(loggerDebugStub.calledWith('getRumdlPath: config value="", final value="rumdl"')).to.be.true;
    });
    
    it('should handle whitespace-only string', () => {
      setConfiguration('rumdl.server.path', '   ');
      
      const path = ConfigurationManager.getRumdlPath();
      
      expect(path).to.equal('rumdl');
    });
    
    it('should trim whitespace from valid paths', () => {
      setConfiguration('rumdl.server.path', '  /path/to/rumdl  ');
      
      const path = ConfigurationManager.getRumdlPath();
      
      expect(path).to.equal('/path/to/rumdl');
    });
  });
  
  describe('getLogLevel', () => {
    it('should return default log level', () => {
      expect(ConfigurationManager.getLogLevel()).to.equal('info');
    });
    
    it('should return configured log level', () => {
      setConfiguration('rumdl.server.logLevel', 'debug');
      expect(ConfigurationManager.getLogLevel()).to.equal('debug');
    });
  });
  
  describe('getTraceLevel', () => {
    it('should return default trace level', () => {
      expect(ConfigurationManager.getTraceLevel()).to.equal('off');
    });
    
    it('should return configured trace level', () => {
      setConfiguration('rumdl.trace.server', 'verbose');
      expect(ConfigurationManager.getTraceLevel()).to.equal('verbose');
    });
  });
  
  describe('shouldDeduplicate', () => {
    it('should return true by default', () => {
      expect(ConfigurationManager.shouldDeduplicate()).to.be.true;
    });
    
    it('should return false when disabled', () => {
      setConfiguration('rumdl.diagnostics.deduplicate', false);
      expect(ConfigurationManager.shouldDeduplicate()).to.be.false;
    });
  });
});