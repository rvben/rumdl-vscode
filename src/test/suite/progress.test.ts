import * as vscode from 'vscode';
import { expect } from '../helper';
import { ProgressUtils } from '../../utils/progress';
import { sleep } from '../helper';

suite('Progress Utils Tests', () => {
  test('withProgress should execute task with progress', async () => {
    let progressReported = false;

    const result = await ProgressUtils.withProgress({ title: 'Test Task' }, async progress => {
      progress.report({ increment: 50, message: 'Half way' });
      progressReported = true;
      return 'completed';
    });

    expect(result.completed).to.be.true;
    expect(result.result).to.equal('completed');
    expect(progressReported).to.be.true;
  });

  test('withProgress should show location when specified', async () => {
    const result = await ProgressUtils.withProgress(
      {
        title: 'Test Task',
        location: vscode.ProgressLocation.Window,
      },
      async progress => {
        progress.report({ increment: 100 });
        return 42;
      }
    );

    expect(result.completed).to.be.true;
    expect(result.result).to.equal(42);
  });

  test('withBatchProgress should process items with progress', async () => {
    const items = [1, 2, 3, 4, 5];
    const processedItems: number[] = [];

    const result = await ProgressUtils.withBatchProgress(
      { title: 'Processing items' },
      items,
      async item => {
        processedItems.push(item);
        await sleep(10);
        return item * 2;
      }
    );

    expect(processedItems).to.deep.equal([1, 2, 3, 4, 5]);
    expect(result.results).to.deep.equal([2, 4, 6, 8, 10]);
    expect(result.errors).to.be.empty;
    expect(result.cancelled).to.be.false;
  });

  test('withBatchProgress should handle errors', async () => {
    const items = [1, 2, 3];

    const result = await ProgressUtils.withBatchProgress(
      { title: 'Error task' },
      items,
      async item => {
        if (item === 2) {
          throw new Error('Item 2 failed');
        }
        return item;
      }
    );

    expect(result.results).to.have.lengthOf(2);
    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors[0].item).to.equal(2);
    expect(result.errors[0].error.message).to.include('Item 2 failed');
  });

  test('createProgressReporter should create progress reporter', () => {
    const reporter = ProgressUtils.createProgressReporter('Test Progress', 100);

    expect(reporter).to.exist;
    expect(reporter.show).to.be.a('function');
    expect(reporter.update).to.be.a('function');
    expect(reporter.complete).to.be.a('function');
    expect(reporter.dispose).to.be.a('function');

    // Test methods don't throw
    reporter.show();
    reporter.update(50, 'Half way');
    reporter.complete();
    reporter.dispose();
  });

  test('showStatusMessage should display message', async () => {
    const disposable = ProgressUtils.showStatusMessage('Test message');

    expect(disposable).to.exist;
    expect(disposable.dispose).to.be.a('function');

    await sleep(100);
    disposable.dispose();
  });

  test('showStatusMessage with timeout', async () => {
    const disposable = ProgressUtils.showStatusMessage('Test message', 500);

    expect(disposable).to.exist;
    expect(disposable.dispose).to.be.a('function');

    disposable.dispose();
  });

  test('createStatusBarItem should create status bar item', () => {
    const item = ProgressUtils.createStatusBarItem();

    expect(item).to.exist;
    expect(item.text).to.equal('');
    expect(item.show).to.be.a('function');
    expect(item.hide).to.be.a('function');

    item.dispose();
  });

  test('createStatusBarItem with custom alignment and priority', () => {
    const item = ProgressUtils.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

    expect(item).to.exist;
    expect(item.alignment).to.equal(vscode.StatusBarAlignment.Left);
    expect(item.priority).to.equal(100);

    item.dispose();
  });
});
