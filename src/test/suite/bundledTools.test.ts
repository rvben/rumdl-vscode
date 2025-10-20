// import * as fs from 'fs';
// import * as path from 'path';
import { expect } from '../helper';
import { BundledToolsManager } from '../../bundledTools';

suite('BundledTools Tests', () => {
  test('hasBundledTools should check for platform binary', () => {
    const hasBundled = BundledToolsManager.hasBundledTools();

    // Result depends on whether bundled tools actually exist
    expect(hasBundled).to.be.a('boolean');
  });

  test('getBundledVersion should read version from file', () => {
    const version = BundledToolsManager.getBundledVersion();

    // Version might be null if version.json doesn't exist
    if (version !== null) {
      expect(version).to.be.an('object');
      expect(version.version).to.be.a('string');
      expect(version.version).to.match(/^\d+\.\d+\.\d+/);
    }
  });

  test('getBundledRumdlPath should return path for supported platform', () => {
    const toolPath = BundledToolsManager.getBundledRumdlPath();

    if (toolPath) {
      expect(toolPath).to.be.a('string');
      expect(toolPath).to.include('bundled-tools');
      expect(toolPath).to.include('rumdl');
    }
  });

  test('getBestRumdlPath should prefer valid custom path', async () => {
    const customPath = '/usr/bin/env'; // Use a path that likely exists
    const result = await BundledToolsManager.getBestRumdlPath(customPath);

    expect(result).to.equal(customPath);
  });

  test('getBestRumdlPath should fallback to system rumdl if no custom path', async () => {
    const result = await BundledToolsManager.getBestRumdlPath();

    // Should return either bundled path or 'rumdl'
    expect(result).to.be.a('string');
    if (!BundledToolsManager.hasBundledTools()) {
      expect(result).to.equal('rumdl');
    }
  });

  test('getBestRumdlPath should use bundled if available', async () => {
    const result = await BundledToolsManager.getBestRumdlPath('rumdl-not-found'); // Use a path that is unlikely to exist

    // Should prefer bundled if available
    expect(result).to.be.a('string');
    if (BundledToolsManager.hasBundledTools() && BundledToolsManager.getBundledRumdlPath()) {
      expect(result).to.include('bundled-tools');
    }
  });

  test('logBundledToolsInfo should not throw', () => {
    expect(() => BundledToolsManager.logBundledToolsInfo()).to.not.throw();
  });

  test('shouldPreferBundled should return boolean', () => {
    const shouldPrefer = BundledToolsManager.shouldPreferBundled();

    expect(shouldPrefer).to.be.a('boolean');

    // Should match whether bundled path exists
    const bundledPath = BundledToolsManager.getBundledRumdlPath();
    expect(shouldPrefer).to.equal(bundledPath !== null);
  });
});
