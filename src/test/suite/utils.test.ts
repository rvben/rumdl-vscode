import { expect } from '../helper';
import * as utils from '../../utils';

suite('Utils Tests', () => {
  test('Logger should initialize without errors', () => {
    expect(() => utils.Logger.initialize('test')).to.not.throw();
  });

  test('Logger should log messages', () => {
    utils.Logger.initialize('test');

    // These should not throw
    expect(() => utils.Logger.info('Test info')).to.not.throw();
    expect(() => utils.Logger.warn('Test warning')).to.not.throw();
    expect(() => utils.Logger.error('Test error')).to.not.throw();
    expect(() => utils.Logger.debug('Test debug')).to.not.throw();
  });

  test('debounce should delay function execution', done => {
    let callCount = 0;
    const debouncedFn = utils.debounce(() => {
      callCount++;
    }, 50);

    // Call multiple times quickly
    debouncedFn();
    debouncedFn();
    debouncedFn();

    // Should not have been called yet
    expect(callCount).to.equal(0);

    // Wait for debounce delay
    setTimeout(() => {
      expect(callCount).to.equal(1);
      done();
    }, 100);
  });
});
