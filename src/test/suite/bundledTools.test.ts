import { 
  expect, 
  sinon,
  beforeEachTest, 
  afterEachTest 
} from '../helper';
import * as fs from 'fs';
import * as path from 'path';
import { BundledToolsManager } from '../../bundledTools';
import * as utils from '../../utils';

describe('BundledToolsManager', () => {
  let vscodeContext: ReturnType<typeof beforeEachTest>;
  let existsSyncStub: sinon.SinonStub;
  let readFileSyncStub: sinon.SinonStub;
  let statSyncStub: sinon.SinonStub;
  let chmodSyncStub: sinon.SinonStub;
  let loggerInfoStub: sinon.SinonStub;
  let loggerWarnStub: sinon.SinonStub;
  let loggerErrorStub: sinon.SinonStub;
  let platformStub: sinon.SinonStub;
  let archStub: sinon.SinonStub;
  
  beforeEach(() => {
    vscodeContext = beforeEachTest();
    
    // Stub fs methods
    existsSyncStub = sinon.stub(fs, 'existsSync');
    readFileSyncStub = sinon.stub(fs, 'readFileSync');
    statSyncStub = sinon.stub(fs, 'statSync');
    chmodSyncStub = sinon.stub(fs, 'chmodSync');
    
    // Stub Logger methods
    loggerInfoStub = sinon.stub(utils.Logger, 'info');
    loggerWarnStub = sinon.stub(utils.Logger, 'warn');
    loggerErrorStub = sinon.stub(utils.Logger, 'error');
    
    // Default platform/arch
    platformStub = sinon.stub(process, 'platform').value('darwin');
    archStub = sinon.stub(process, 'arch').value('arm64');
  });
  
  afterEach(() => {
    sinon.restore();
    afterEachTest();
  });
  
  describe('getPlatformKey', () => {
    it('should return correct key for Windows x64', () => {
      platformStub.value('win32');
      archStub.value('x64');
      
      const key = BundledToolsManager['getPlatformKey']();
      expect(key).to.equal('win32-x64');
    });
    
    it('should return correct key for macOS x64', () => {
      platformStub.value('darwin');
      archStub.value('x64');
      
      const key = BundledToolsManager['getPlatformKey']();
      expect(key).to.equal('darwin-x64');
    });
    
    it('should return correct key for macOS ARM64', () => {
      platformStub.value('darwin');
      archStub.value('arm64');
      
      const key = BundledToolsManager['getPlatformKey']();
      expect(key).to.equal('darwin-arm64');
    });
    
    it('should return correct key for Linux x64', () => {
      platformStub.value('linux');
      archStub.value('x64');
      
      const key = BundledToolsManager['getPlatformKey']();
      expect(key).to.equal('linux-x64');
    });
    
    it('should return correct key for Linux ARM64', () => {
      platformStub.value('linux');
      archStub.value('arm64');
      
      const key = BundledToolsManager['getPlatformKey']();
      expect(key).to.equal('linux-arm64');
    });
    
    it('should throw for unsupported platform', () => {
      platformStub.value('freebsd');
      archStub.value('x64');
      
      expect(() => BundledToolsManager['getPlatformKey']()).to.throw('Unsupported platform: freebsd-x64');
    });
  });
  
  describe('hasBundledTools', () => {
    it('should return true when bundled tools directory exists', () => {
      existsSyncStub.returns(true);
      
      expect(BundledToolsManager.hasBundledTools()).to.be.true;
      expect(existsSyncStub.calledWith(path.join(__dirname, '..', '..', '..', 'bundled-tools'))).to.be.true;
    });
    
    it('should return false when bundled tools directory does not exist', () => {
      existsSyncStub.returns(false);
      
      expect(BundledToolsManager.hasBundledTools()).to.be.false;
    });
  });
  
  describe('getBundledVersion', () => {
    it('should return version info when version.json exists', () => {
      const versionData = {
        version: '0.0.84',
        downloadedAt: '2024-01-01T00:00:00Z',
        platforms: ['darwin-arm64', 'darwin-x64', 'linux-x64']
      };
      
      existsSyncStub.returns(true);
      readFileSyncStub.returns(JSON.stringify(versionData));
      
      const version = BundledToolsManager.getBundledVersion();
      
      expect(version).to.deep.equal(versionData);
    });
    
    it('should return null when version.json does not exist', () => {
      existsSyncStub.returns(false);
      
      const version = BundledToolsManager.getBundledVersion();
      
      expect(version).to.be.null;
    });
    
    it('should handle JSON parse errors', () => {
      existsSyncStub.returns(true);
      readFileSyncStub.returns('invalid json');
      
      const version = BundledToolsManager.getBundledVersion();
      
      expect(version).to.be.null;
      expect(loggerErrorStub.called).to.be.true;
    });
  });
  
  describe('getBundledRumdlPath', () => {
    it('should return path to bundled binary for current platform', () => {
      existsSyncStub.returns(true);
      statSyncStub.returns({ mode: parseInt('755', 8) });
      
      const path = BundledToolsManager.getBundledRumdlPath();
      
      expect(path).to.include('bundled-tools');
      expect(path).to.include('rumdl-aarch64-apple-darwin');
    });
    
    it('should return null when bundled tools do not exist', () => {
      existsSyncStub.returns(false);
      
      const path = BundledToolsManager.getBundledRumdlPath();
      
      expect(path).to.be.null;
    });
    
    it('should return null for unsupported platform', () => {
      platformStub.value('aix');
      existsSyncStub.returns(true);
      
      const path = BundledToolsManager.getBundledRumdlPath();
      
      expect(path).to.be.null;
      expect(loggerErrorStub.called).to.be.true;
    });
    
    it('should make binary executable on Unix if not already', () => {
      platformStub.value('linux');
      existsSyncStub.returns(true);
      statSyncStub.returns({ mode: parseInt('644', 8) }); // Not executable
      
      const path = BundledToolsManager.getBundledRumdlPath();
      
      expect(chmodSyncStub.calledWith(sinon.match.string, 0o755)).to.be.true;
      expect(path).to.not.be.null;
    });
    
    it('should skip executable check on Windows', () => {
      platformStub.value('win32');
      existsSyncStub.returns(true);
      
      const path = BundledToolsManager.getBundledRumdlPath();
      
      expect(statSyncStub.called).to.be.false;
      expect(path).to.include('.exe');
    });
    
    it('should handle permission check errors gracefully', () => {
      existsSyncStub.returns(true);
      statSyncStub.throws(new Error('Permission denied'));
      
      const path = BundledToolsManager.getBundledRumdlPath();
      
      expect(path).to.be.null;
      expect(loggerErrorStub.called).to.be.true;
    });
  });
  
  describe('getBestRumdlPath', () => {
    it('should use configured path when provided', async () => {
      const configuredPath = '/custom/path/to/rumdl';
      
      const path = await BundledToolsManager.getBestRumdlPath(configuredPath);
      
      expect(path).to.equal(configuredPath);
      expect(loggerInfoStub.calledWith(`Using configured rumdl path: ${configuredPath}`)).to.be.true;
    });
    
    it('should use bundled binary when available and no configured path', async () => {
      existsSyncStub.returns(true);
      statSyncStub.returns({ mode: parseInt('755', 8) });
      readFileSyncStub.returns(JSON.stringify({ version: '0.0.84' }));
      
      const path = await BundledToolsManager.getBestRumdlPath();
      
      expect(path).to.include('bundled-tools');
      expect(loggerInfoStub.calledWith(sinon.match(/Using bundled rumdl/))).to.be.true;
    });
    
    it('should fall back to system rumdl when no bundled binary', async () => {
      existsSyncStub.returns(false);
      
      const path = await BundledToolsManager.getBestRumdlPath();
      
      expect(path).to.equal('rumdl');
      expect(loggerInfoStub.calledWith('No bundled rumdl found, falling back to system rumdl')).to.be.true;
    });
    
    it('should ignore "rumdl" as configured path', async () => {
      existsSyncStub.returns(false);
      
      const path = await BundledToolsManager.getBestRumdlPath('rumdl');
      
      expect(path).to.equal('rumdl');
      expect(loggerInfoStub.calledWith('No bundled rumdl found, falling back to system rumdl')).to.be.true;
    });
  });
  
  describe('logBundledToolsInfo', () => {
    it('should log when no bundled tools found', () => {
      existsSyncStub.returns(false);
      
      BundledToolsManager.logBundledToolsInfo();
      
      expect(loggerInfoStub.calledWith('No bundled tools found - will use system rumdl')).to.be.true;
    });
    
    it('should log version info when bundled tools exist', () => {
      const versionData = {
        version: '0.0.84',
        downloadedAt: '2024-01-01T00:00:00Z',
        platforms: ['darwin-arm64', 'darwin-x64']
      };
      
      existsSyncStub.returns(true);
      readFileSyncStub.returns(JSON.stringify(versionData));
      statSyncStub.returns({ mode: parseInt('755', 8) });
      
      BundledToolsManager.logBundledToolsInfo();
      
      expect(loggerInfoStub.calledWith(sinon.match(/Bundled tools available: rumdl 0.0.84/))).to.be.true;
      expect(loggerInfoStub.calledWith('Supported platforms: darwin-arm64, darwin-x64')).to.be.true;
    });
    
    it('should warn when no binary for current platform', () => {
      platformStub.value('freebsd');
      existsSyncStub.returns(true);
      readFileSyncStub.returns(JSON.stringify({ version: '0.0.84' }));
      
      BundledToolsManager.logBundledToolsInfo();
      
      expect(loggerWarnStub.called).to.be.true;
    });
  });
  
  describe('shouldPreferBundled', () => {
    it('should return true when bundled binary is available', () => {
      existsSyncStub.returns(true);
      statSyncStub.returns({ mode: parseInt('755', 8) });
      
      expect(BundledToolsManager.shouldPreferBundled()).to.be.true;
    });
    
    it('should return false when no bundled binary available', () => {
      existsSyncStub.returns(false);
      
      expect(BundledToolsManager.shouldPreferBundled()).to.be.false;
    });
  });
});