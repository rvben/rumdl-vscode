import * as vscode from 'vscode';
import { Logger } from './utils';

export interface RumdlConfig {
  enable: boolean;
  configPath?: string;
  rules: {
    select: string[];
    ignore: string[];
  };
  server: {
    path: string;
    logLevel: string;
  };
  trace: {
    server: string;
  };
  diagnostics: {
    deduplicate: boolean;
  };
}

export class ConfigurationManager {
  public static getConfiguration(): RumdlConfig {
    const config = vscode.workspace.getConfiguration('rumdl');

    return {
      enable: config.get('enable', true),
      configPath: config.get('configPath'),
      rules: {
        select: config.get('rules.select', []),
        ignore: config.get('rules.ignore', [])
      },
      server: {
        path: config.get('server.path', 'rumdl'),
        logLevel: config.get('server.logLevel', 'info')
      },
      trace: {
        server: config.get('trace.server', 'off')
      },
      diagnostics: {
        deduplicate: config.get('diagnostics.deduplicate', true)
      }
    };
  }

  public static onConfigurationChanged(
    callback: (config: RumdlConfig) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('rumdl')) {
        callback(this.getConfiguration());
      }
    });
  }

  public static isEnabled(): boolean {
    return this.getConfiguration().enable;
  }

  public static getRumdlPath(): string {
    const config = vscode.workspace.getConfiguration('rumdl');
    const path = config.get('server.path', 'rumdl');

    // Ensure we never return an empty string
    const finalPath = path && path.trim() !== '' ? path : 'rumdl';

    Logger.debug(`getRumdlPath: config value="${path}", final value="${finalPath}"`);

    return finalPath;
  }

  public static getLogLevel(): string {
    return this.getConfiguration().server.logLevel;
  }

  public static getTraceLevel(): string {
    return this.getConfiguration().trace.server;
  }

  public static shouldDeduplicate(): boolean {
    return this.getConfiguration().diagnostics.deduplicate;
  }
}