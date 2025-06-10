import { 
  expect, 
  sinon, 
  beforeEachTest, 
  afterEachTest 
} from '../helper';
import { ProgressUtils } from '../../utils/progress';

describe('ProgressUtils', () => {
  let vscodeContext: ReturnType<typeof beforeEachTest>;
  let clock: sinon.SinonFakeTimers;
  
  beforeEach(() => {
    vscodeContext = beforeEachTest();
    clock = sinon.useFakeTimers();
  });
  
  afterEach(() => {
    clock.restore();
    afterEachTest();
  });
  
  describe('withProgress', () => {
    it('should show progress with default options', async () => {
      const task = sinon.stub().resolves('result');
      
      const result = await ProgressUtils.withProgress(
        { title: 'Test Task' },
        task
      );
      
      expect(result.completed).to.be.true;
      expect(result.cancelled).to.be.false;
      expect(result.result).to.equal('result');
      expect(vscodeContext.vscode.window.withProgress.calledOnce).to.be.true;
      
      const options = vscodeContext.vscode.window.withProgress.firstCall.args[0];
      expect(options.location).to.equal(vscodeContext.vscode.ProgressLocation.Notification);
      expect(options.title).to.equal('Test Task');
      expect(options.cancellable).to.be.true;
    });
    
    it('should handle custom options', async () => {
      const task = sinon.stub().resolves();
      
      await ProgressUtils.withProgress(
        {
          title: 'Custom Task',
          location: vscodeContext.vscode.ProgressLocation.Window,
          cancellable: false
        },
        task
      );
      
      const options = vscodeContext.vscode.window.withProgress.firstCall.args[0];
      expect(options.location).to.equal(vscodeContext.vscode.ProgressLocation.Window);
      expect(options.cancellable).to.be.false;
    });
    
    it('should pass progress reporter to task', async () => {
      let capturedProgress: any;
      const task = sinon.stub().callsFake((progress) => {
        capturedProgress = progress;
        return Promise.resolve();
      });
      
      await ProgressUtils.withProgress({ title: 'Test' }, task);
      
      expect(capturedProgress).to.exist;
      expect(capturedProgress.report).to.be.a('function');
    });
    
    it('should pass cancellation token to task', async () => {
      let capturedToken: any;
      const task = sinon.stub().callsFake((progress, token) => {
        capturedToken = token;
        return Promise.resolve();
      });
      
      await ProgressUtils.withProgress({ title: 'Test', cancellable: true }, task);
      
      expect(capturedToken).to.exist;
      expect(capturedToken.isCancellationRequested).to.be.false;
      expect(capturedToken.onCancellationRequested).to.be.a('function');
    });
    
    it('should handle task errors', async () => {
      const error = new Error('Task failed');
      const task = sinon.stub().rejects(error);
      
      const result = await ProgressUtils.withProgress({ title: 'Test' }, task);
      
      expect(result.completed).to.be.false;
      expect(result.error).to.equal(error);
    });
    
    it('should handle cancellation', async () => {
      // Override withProgress to simulate cancellation
      const originalWithProgress = vscodeContext.vscode.window.withProgress;
      vscodeContext.vscode.window.withProgress = sinon.stub().callsFake(async (options, task) => {
        const mockToken = {
          isCancellationRequested: true,
          onCancellationRequested: sinon.stub()
        };
        const mockProgress = { report: sinon.stub() };
        return task(mockProgress, mockToken);
      });
      
      const task = sinon.stub().resolves('should not reach');
      const result = await ProgressUtils.withProgress({ title: 'Test' }, task);
      
      expect(result.cancelled).to.be.true;
      expect(result.completed).to.be.false;
      expect(task.called).to.be.false;
      
      vscodeContext.vscode.window.withProgress = originalWithProgress;
    });
  });
  
  describe('withBatchProgress', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = sinon.stub().callsFake(item => Promise.resolve(item * 2));
      
      const result = await ProgressUtils.withBatchProgress(
        { title: 'Batch processing' },
        items,
        processor,
        2 // batch size
      );
      
      expect(result.results).to.deep.equal([2, 4, 6, 8, 10]);
      expect(result.errors).to.be.empty;
      expect(result.cancelled).to.be.false;
      expect(processor.callCount).to.equal(5);
    });
    
    it('should handle processor errors', async () => {
      const items = [1, 2, 3];
      const processor = sinon.stub();
      processor.onFirstCall().resolves(1);
      processor.onSecondCall().rejects(new Error('Failed'));
      processor.onThirdCall().resolves(3);
      
      const result = await ProgressUtils.withBatchProgress(
        { title: 'Test' },
        items,
        processor,
        1
      );
      
      expect(result.results).to.deep.equal([1, 3]);
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0].item).to.equal(2);
      expect(result.errors[0].error.message).to.equal('Failed');
    });
    
    it('should report progress with percentage', async () => {
      const items = [1, 2, 3, 4];
      const processor = sinon.stub().resolves();
      
      await ProgressUtils.withBatchProgress(
        { title: 'Test', showPercentage: true },
        items,
        processor,
        2
      );
      
      // Check that progress was reported
      const progressTask = vscodeContext.vscode.window.withProgress.firstCall.args[1];
      const mockProgress = { report: sinon.stub() };
      const mockToken = { isCancellationRequested: false };
      
      await progressTask(mockProgress, mockToken);
      
      expect(mockProgress.report.called).to.be.true;
      // Check that increment is included when showPercentage is true
      const reportCalls = mockProgress.report.getCalls();
      expect(reportCalls.some(call => call.args[0].increment !== undefined)).to.be.true;
    });
    
    it('should handle cancellation', async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = sinon.stub().resolves();
      
      // Override withProgress to simulate cancellation after first batch
      let callCount = 0;
      const originalWithProgress = vscodeContext.vscode.window.withProgress;
      vscodeContext.vscode.window.withProgress = sinon.stub().callsFake(async (options, task) => {
        const mockToken = {
          isCancellationRequested: false,
          onCancellationRequested: sinon.stub()
        };
        const mockProgress = { 
          report: sinon.stub().callsFake(() => {
            callCount++;
            if (callCount > 1) {
              mockToken.isCancellationRequested = true;
            }
          })
        };
        return task(mockProgress, mockToken);
      });
      
      const result = await ProgressUtils.withBatchProgress(
        { title: 'Test' },
        items,
        processor,
        2
      );
      
      expect(result.cancelled).to.be.true;
      expect(processor.callCount).to.be.lessThan(5);
      
      vscodeContext.vscode.window.withProgress = originalWithProgress;
    });
  });
  
  describe('createProgressReporter', () => {
    it('should create a progress reporter', () => {
      const reporter = ProgressUtils.createProgressReporter('Test', 100);
      
      expect(reporter).to.have.property('show');
      expect(reporter).to.have.property('update');
      expect(reporter).to.have.property('increment');
      expect(reporter).to.have.property('complete');
      expect(reporter).to.have.property('error');
    });
    
    it('should show progress window', () => {
      const reporter = ProgressUtils.createProgressReporter('Test', 100);
      reporter.show();
      
      expect(vscodeContext.vscode.window.withProgress.calledOnce).to.be.true;
      expect(vscodeContext.vscode.window.withProgress.firstCall.args[0].title).to.equal('Test');
    });
    
    it('should update progress', async () => {
      const reporter = ProgressUtils.createProgressReporter('Test', 100);
      reporter.show();
      
      // Get the progress task
      const progressTask = vscodeContext.vscode.window.withProgress.firstCall.args[1];
      const mockProgress = { report: sinon.stub() };
      const mockToken = { isCancellationRequested: false };
      
      // Start the task in background
      const taskPromise = progressTask(mockProgress, mockToken);
      
      // Update progress
      reporter.update(50, 'Halfway there');
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockProgress.report.called).to.be.true;
      expect(mockProgress.report.firstCall.args[0]).to.include({
        message: 'Halfway there',
        increment: 50
      });
      
      reporter.complete();
      await taskPromise;
    });
  });
  
  describe('showStatusMessage', () => {
    it('should show status message without timeout', () => {
      const disposable = ProgressUtils.showStatusMessage('Test message');
      
      expect(vscodeContext.vscode.window.setStatusBarMessage.calledOnce).to.be.true;
      expect(vscodeContext.vscode.window.setStatusBarMessage.firstCall.args).to.deep.equal(['Test message']);
      expect(disposable).to.exist;
    });
    
    it('should show status message with timeout', () => {
      const disposable = ProgressUtils.showStatusMessage('Temporary message', 5000);
      
      expect(vscodeContext.vscode.window.setStatusBarMessage.calledOnce).to.be.true;
      expect(vscodeContext.vscode.window.setStatusBarMessage.firstCall.args).to.deep.equal(['Temporary message', 5000]);
      expect(disposable).to.exist;
    });
  });
  
  describe('createStatusBarItem', () => {
    it('should create status bar item with defaults', () => {
      const item = ProgressUtils.createStatusBarItem();
      
      expect(vscodeContext.vscode.window.createStatusBarItem.calledOnce).to.be.true;
      expect(vscodeContext.vscode.window.createStatusBarItem.firstCall.args).to.deep.equal([
        vscodeContext.vscode.StatusBarAlignment.Left,
        undefined
      ]);
      expect(item).to.exist;
    });
    
    it('should create status bar item with custom alignment and priority', () => {
      const item = ProgressUtils.createStatusBarItem(
        vscodeContext.vscode.StatusBarAlignment.Right,
        100
      );
      
      expect(vscodeContext.vscode.window.createStatusBarItem.firstCall.args).to.deep.equal([
        vscodeContext.vscode.StatusBarAlignment.Right,
        100
      ]);
    });
  });
});