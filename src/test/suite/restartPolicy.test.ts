import { expect } from '../helper';
import { ServerRestartPolicy } from '../../restartPolicy';

suite('Server Restart Policy Tests', () => {
  test('returns exponential delays for attempts inside the crash window', () => {
    const policy = new ServerRestartPolicy(5, 180_000, 10_000);

    expect(policy.next(0)).to.deep.equal({ attempt: 1, delayMs: 1_000 });
    expect(policy.next(1_000)).to.deep.equal({ attempt: 2, delayMs: 2_000 });
    expect(policy.next(2_000)).to.deep.equal({ attempt: 3, delayMs: 4_000 });
    expect(policy.next(3_000)).to.deep.equal({ attempt: 4, delayMs: 8_000 });
    expect(policy.next(4_000)).to.deep.equal({ attempt: 5, delayMs: 10_000 });
  });

  test('refuses a sixth restart even when earlier restarts reached Running', () => {
    const policy = new ServerRestartPolicy();

    for (let attempt = 0; attempt < 5; attempt++) {
      expect(policy.next(attempt * 1_000)).to.exist;
    }

    expect(policy.next(5_000)).to.be.undefined;
  });

  test('forgets crashes outside the rolling window', () => {
    const policy = new ServerRestartPolicy(2, 5_000);

    expect(policy.next(0)?.attempt).to.equal(1);
    expect(policy.next(1_000)?.attempt).to.equal(2);
    expect(policy.next(2_000)).to.be.undefined;
    expect(policy.next(6_001)?.attempt).to.equal(1);
  });

  test('manual reset starts a fresh crash history', () => {
    const policy = new ServerRestartPolicy(1);

    expect(policy.next(0)?.attempt).to.equal(1);
    expect(policy.next(1_000)).to.be.undefined;

    policy.reset();

    expect(policy.next(1_000)?.attempt).to.equal(1);
  });
});
