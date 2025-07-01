import * as vscode from 'vscode';

/**
 * Options for progress operations
 */
export interface ProgressOptions {
  title: string;
  location?: vscode.ProgressLocation;
  cancellable?: boolean;
  showPercentage?: boolean;
}

/**
 * Result of a progress operation
 */
export interface ProgressResult<T> {
  completed: boolean;
  cancelled: boolean;
  result?: T;
  error?: Error;
}

/**
 * Utility class for managing progress indicators
 */
export class ProgressUtils {
  /**
   * Show progress while executing an async operation
   * @param options Progress options
   * @param task The async task to execute
   * @returns Result of the operation
   */
  static async withProgress<T>(
    options: ProgressOptions,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken
    ) => Promise<T>
  ): Promise<ProgressResult<T>> {
    const location = options.location || vscode.ProgressLocation.Notification;

    return vscode.window.withProgress(
      {
        location,
        title: options.title,
        cancellable: options.cancellable ?? true,
      },
      async (progress, token) => {
        try {
          // Check if already cancelled
          if (token.isCancellationRequested) {
            return {
              completed: false,
              cancelled: true,
            };
          }

          const result = await task(progress, token);

          return {
            completed: true,
            cancelled: token.isCancellationRequested,
            result,
          };
        } catch (error) {
          return {
            completed: false,
            cancelled: token.isCancellationRequested,
            error: error as Error,
          };
        }
      }
    );
  }

  /**
   * Show progress for batch operations
   * @param options Progress options
   * @param items Items to process
   * @param processor Function to process each item
   * @param batchSize Number of items to process at once
   * @returns Results and any errors
   */
  static async withBatchProgress<T, R>(
    options: ProgressOptions,
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 5
  ): Promise<{
    results: R[];
    errors: Array<{ item: T; error: Error }>;
    cancelled: boolean;
  }> {
    const results: R[] = [];
    const errors: Array<{ item: T; error: Error }> = [];
    let cancelled = false;

    await vscode.window.withProgress(
      {
        location: options.location || vscode.ProgressLocation.Notification,
        title: options.title,
        cancellable: options.cancellable ?? true,
      },
      async (progress, token) => {
        let processed = 0;
        const total = items.length;

        for (let i = 0; i < items.length && !token.isCancellationRequested; i += batchSize) {
          const batch = items.slice(i, i + batchSize);

          // Update progress message
          progress.report({
            message: `Processing ${processed} of ${total}...`,
            increment: options.showPercentage ? (batch.length / total) * 100 : undefined,
          });

          // Process batch in parallel
          const batchPromises = batch.map(async item => {
            try {
              const result = await processor(item);
              return { success: true, result, item };
            } catch (error) {
              return { success: false, error: error as Error, item };
            }
          });

          const batchResults = await Promise.all(batchPromises);

          // Collect results and errors
          for (const batchResult of batchResults) {
            if (batchResult.success) {
              results.push(batchResult.result as R);
            } else {
              errors.push({
                item: batchResult.item,
                error: batchResult.error as Error,
              });
            }
          }

          processed += batch.length;
        }

        cancelled = token.isCancellationRequested;
      }
    );

    return { results, errors, cancelled };
  }

  /**
   * Create a progress reporter for long-running operations
   */
  static createProgressReporter(
    title: string,
    total: number,
    options?: Partial<ProgressOptions>
  ): {
    show: () => void;
    update: (current: number, message?: string) => void;
    complete: () => void;
    dispose: () => void;
  } {
    let progressResolve: ((value: void) => void) | undefined;
    let currentProgress: vscode.Progress<{ message?: string; increment?: number }> | undefined;
    let disposed = false;

    vscode.window.withProgress(
      {
        location: options?.location || vscode.ProgressLocation.Notification,
        title,
        cancellable: options?.cancellable ?? false,
      },
      async progress => {
        currentProgress = progress;
        return new Promise<void>(resolve => {
          progressResolve = resolve;
        });
      }
    );

    return {
      show: () => {
        // Progress is shown automatically
      },
      update: (current: number, message?: string) => {
        if (!disposed && currentProgress) {
          const percentage = Math.round((current / total) * 100);
          currentProgress.report({
            message: message || `${current} of ${total} (${percentage}%)`,
            increment: options?.showPercentage ? (1 / total) * 100 : undefined,
          });
        }
      },
      complete: () => {
        if (!disposed && progressResolve) {
          progressResolve();
          disposed = true;
        }
      },
      dispose: () => {
        if (!disposed && progressResolve) {
          progressResolve();
          disposed = true;
        }
      },
    };
  }

  /**
   * Show a simple status bar message with optional timeout
   * @param message The message to show
   * @param timeout Optional timeout in milliseconds
   * @returns Disposable to hide the message
   */
  static showStatusMessage(message: string, timeout?: number): vscode.Disposable {
    if (timeout !== undefined) {
      return vscode.window.setStatusBarMessage(message, timeout);
    }
    return vscode.window.setStatusBarMessage(message);
  }

  /**
   * Create a status bar item for persistent status
   * @param priority Priority for placement
   * @returns Status bar item
   */
  static createStatusBarItem(
    alignment: vscode.StatusBarAlignment = vscode.StatusBarAlignment.Left,
    priority?: number
  ): vscode.StatusBarItem {
    return vscode.window.createStatusBarItem(alignment, priority);
  }
}
