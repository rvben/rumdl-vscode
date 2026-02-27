import * as vscode from 'vscode';
import { Logger } from './utils';

export interface RumdlConfig {
  enable: boolean;
  fixOnSave: boolean;
  configPath?: string;
  rules: {
    enable: string[];
    disable: string[];
  };
  server: {
    path?: string; // undefined = use bundled if available, 'rumdl' = use system PATH, custom = use that path
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
      fixOnSave: config.get('fixOnSave', false),
      configPath: config.get('configPath'),
      rules: {
        enable: config.get('rules.enable', []),
        disable: config.get('rules.disable', []),
      },
      server: {
        path: config.get('server.path'), // undefined by default - let getBestRumdlPath decide
        logLevel: config.get('server.logLevel', 'info'),
      },
      trace: {
        server: config.get('trace.server', 'off'),
      },
      diagnostics: {
        deduplicate: config.get('diagnostics.deduplicate', true),
      },
    };
  }

  public static onConfigurationChanged(callback: (config: RumdlConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('rumdl')) {
        callback(this.getConfiguration());
      }
    });
  }

  public static isEnabled(): boolean {
    return this.getConfiguration().enable;
  }

  public static getRumdlPath(): string | undefined {
    const config = vscode.workspace.getConfiguration('rumdl');
    const path = config.get<string>('server.path');

    // Return undefined if not configured or empty - let getBestRumdlPath decide
    const finalPath = path && path.trim() !== '' ? path : undefined;

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
