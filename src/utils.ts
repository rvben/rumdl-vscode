import * as vscode from 'vscode';

export class Logger {
  private static outputChannel: vscode.OutputChannel;

  public static initialize(name: string): void {
    this.outputChannel = vscode.window.createOutputChannel(name);
  }

  public static info(message: string): void {
    this.log('INFO', message);
  }

  public static warn(message: string): void {
    this.log('WARN', message);
  }

  public static error(message: string, error?: Error): void {
    const errorMessage = error ? `${message}: ${error.message}` : message;
    this.log('ERROR', errorMessage);
    if (error?.stack && this.outputChannel) {
      this.outputChannel.appendLine(error.stack);
    }
  }

  public static debug(message: string): void {
    this.log('DEBUG', message);
  }

  private static log(level: string, message: string): void {
    // If outputChannel is not initialized (e.g., in tests), skip logging
    if (!this.outputChannel) {
      return;
    }
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }

  public static show(): void {
    if (this.outputChannel) {
      this.outputChannel.show();
    }
  }

  public static dispose(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose();
    }
  }
}

export function showErrorMessage(
  message: string,
  ...actions: string[]
): Thenable<string | undefined> {
  // In test mode, just log instead of showing UI
  if (process.env.VSCODE_TEST === '1' || process.env.NODE_ENV === 'test') {
    Logger.error(`[Error Message] ${message}`);
    return Promise.resolve(undefined);
  }
  return vscode.window.showErrorMessage(message, ...actions);
}

export function showInformationMessage(
  message: string,
  ...actions: string[]
): Thenable<string | undefined> {
  // In test mode, just log instead of showing UI
  if (process.env.VSCODE_TEST === '1' || process.env.NODE_ENV === 'test') {
    Logger.info(`[Info Message] ${message}`);
    return Promise.resolve(undefined);
  }
  return vscode.window.showInformationMessage(message, ...actions);
}

export function showWarningMessage(
  message: string,
  ...actions: string[]
): Thenable<string | undefined> {
  // In test mode, just log instead of showing UI
  if (process.env.VSCODE_TEST === '1' || process.env.NODE_ENV === 'test') {
    Logger.warn(`[Warning Message] ${message}`);
    return Promise.resolve(undefined);
  }
  return vscode.window.showWarningMessage(message, ...actions);
}

export async function checkRumdlInstallation(rumdlPath: string): Promise<boolean> {
  // Validate the path parameter
  if (!rumdlPath || rumdlPath.trim() === '') {
    Logger.error('checkRumdlInstallation called with empty or invalid path');
    return false;
  }

  Logger.info(`Checking rumdl installation at path: "${rumdlPath}"`);

  try {
    const { spawn } = await import('child_process');
    return new Promise(resolve => {
      const process = spawn(rumdlPath, ['--version'], { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', data => {
        stdout += data.toString();
      });

      process.stderr?.on('data', data => {
        stderr += data.toString();
      });

      process.on('error', error => {
        Logger.debug(`Process error for "${rumdlPath}": ${error.message}`);
        resolve(false);
      });

      process.on('exit', code => {
        Logger.debug(`Process exit code for "${rumdlPath}": ${code}`);

        if (code === 0) {
          const version = stdout.trim();
          if (version) {
            Logger.info(`rumdl version: ${version}`);
          } else {
            Logger.warn('rumdl --version returned empty output');
          }
          resolve(true);
        } else {
          if (stderr.trim()) {
            Logger.debug(`rumdl --version stderr: ${stderr.trim()}`);
          }
          resolve(false);
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        Logger.debug(`Process timeout for "${rumdlPath}"`);
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    Logger.error('Failed to check rumdl installation', error as Error);
    return false;
  }
}

export async function getRumdlVersion(rumdlPath: string): Promise<string | null> {
  if (!rumdlPath || rumdlPath.trim() === '') {
    return null;
  }

  try {
    const { spawn } = await import('child_process');
    return new Promise(resolve => {
      const process = spawn(rumdlPath, ['--version'], { stdio: 'pipe' });
      let stdout = '';

      process.stdout?.on('data', data => {
        stdout += data.toString();
      });

      process.on('error', () => {
        resolve(null);
      });

      process.on('exit', code => {
        if (code === 0) {
          const version = stdout.trim();
          resolve(version || null);
        } else {
          resolve(null);
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(null);
      }, 5000);
    });
  } catch {
    return null;
  }
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
