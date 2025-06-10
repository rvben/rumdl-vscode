import * as assert from 'assert';
import { Logger, checkRumdlInstallation, showInformationMessage } from '../../utils';

suite('Utils Test Suite', () => {
  test('Logger should have info method', () => {
    assert.ok(typeof Logger.info === 'function');
  });

  test('Logger should have debug method', () => {
    assert.ok(typeof Logger.debug === 'function');
  });

  test('Logger should have error method', () => {
    assert.ok(typeof Logger.error === 'function');
  });

  test('checkRumdlInstallation should be function', () => {
    assert.ok(typeof checkRumdlInstallation === 'function');
  });

  test('showInformationMessage should be function', () => {
    assert.ok(typeof showInformationMessage === 'function');
  });

  test('checkRumdlInstallation should return Promise', () => {
    const result = checkRumdlInstallation('rumdl');
    assert.ok(result instanceof Promise);
  });
});
