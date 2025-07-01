import * as sinon from 'sinon';
import { EventEmitter } from 'events';

export enum State {
  Stopped = 1,
  Starting = 3,
  Running = 2,
}

export const RevealOutputChannelOn = {
  Never: 'never',
  Error: 'error',
  Warn: 'warn',
  Info: 'info',
};

export class LanguageClient extends EventEmitter {
  public state: State = State.Stopped;
  public onDidChangeState: sinon.SinonStub;
  public onNotification: sinon.SinonStub;
  public start: sinon.SinonStub;
  public stop: sinon.SinonStub;
  public sendRequest: sinon.SinonStub;
  private stateEmitter: EventEmitter;

  constructor(_id: string, _name: string, _serverOptions: any, _clientOptions: any) {
    super();
    this.stateEmitter = new EventEmitter();
    this.onDidChangeState = sinon.stub().callsFake(handler => {
      this.stateEmitter.on('stateChange', handler);
      return { dispose: () => this.stateEmitter.removeListener('stateChange', handler) };
    });
    this.onNotification = sinon.stub();
    this.start = sinon.stub().resolves();
    this.stop = sinon.stub().resolves();
    this.sendRequest = sinon.stub();
  }

  setState(newState: State) {
    const oldState = this.state;
    this.state = newState;
    this.stateEmitter.emit('stateChange', { oldState, newState });
  }
}

export interface LanguageClientOptions {
  documentSelector?: any;
  synchronize?: any;
  diagnosticCollectionName?: string;
  revealOutputChannelOn?: string;
  outputChannelName?: string;
  traceOutputChannel?: any;
}

export interface ServerOptions {
  command?: string;
  args?: string[];
  options?: any;
}
