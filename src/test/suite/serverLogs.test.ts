import * as assert from 'assert';
import { guardOutputChannel } from '../../serverLogs';

suite('Server log channel lifecycle', () => {
  test('preserves channel methods and their receiver before disposal', () => {
    const target = {
      name: 'server',
      lines: [] as string[],
      info(line: string) {
        this.lines.push(line);
      },
      dispose() {},
    };
    const channel = guardOutputChannel(target);
    const write = channel.info;
    write('startup');
    assert.equal(channel.name, 'server');
    assert.deepStrictEqual(target.lines, ['startup']);
  });

  test('ignores buffered and process-exit callbacks after disposing exactly once', () => {
    let disposed = false;
    let disposals = 0;
    const lines: string[] = [];
    const channel = guardOutputChannel({
      info(line: string) {
        assert.equal(disposed, false, 'underlying disposed channels cannot be written to');
        lines.push(line);
      },
      dispose() {
        disposed = true;
        disposals++;
      },
    });
    const bufferedWrite = channel.info;
    channel.info('running');
    channel.dispose();
    bufferedWrite('buffered stderr');
    channel.info('process exited');
    channel.dispose();
    assert.deepStrictEqual(lines, ['running']);
    assert.equal(disposals, 1);
  });

  test('tolerates a channel closed by VS Code while preserving unrelated errors', () => {
    let writes = 0;
    const channel = guardOutputChannel({
      info() {
        writes++;
        throw new Error('Channel has been closed');
      },
      dispose() {},
    });
    channel.info();
    channel.info();
    assert.equal(writes, 1);
    const broken = guardOutputChannel({
      info() {
        throw new Error('unexpected failure');
      },
      dispose() {},
    });
    assert.throws(() => broken.info(), /unexpected failure/);
  });
});
