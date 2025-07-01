import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Utility functions for workspace operations
 */
export class WorkspaceUtils {
  /**
   * Find all Markdown files in the workspace
   * @param includePattern Optional glob pattern to include files
   * @param excludePattern Optional glob pattern to exclude files
   * @returns Array of URIs for Markdown files
   */
  static async findMarkdownFiles(
    includePattern?: string,
    excludePattern?: string
  ): Promise<vscode.Uri[]> {
    const defaultPattern = '**/*.{md,markdown,mdx,mdown,mkd}';
    const pattern = includePattern || defaultPattern;

    // Default excludes based on common patterns
    const defaultExcludes = [
      '**/node_modules/**',
      '**/bower_components/**',
      '**/.git/**',
      '**/.svn/**',
      '**/.hg/**',
      '**/CVS/**',
      '**/.DS_Store/**',
      '**/Thumbs.db/**',
      '**/.vscode/**',
      '**/.idea/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/target/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/coverage/**',
      '**/.nyc_output/**',
    ];

    // Combine default excludes with user-provided excludes
    const excludes = excludePattern
      ? `{${excludePattern},${defaultExcludes.join(',')}}`
      : `{${defaultExcludes.join(',')}}`;

    // Find files using VS Code's built-in file search
    const files = await vscode.workspace.findFiles(pattern, excludes);

    return files;
  }

  /**
   * Get all workspace folders
   * @returns Array of workspace folder paths
   */
  static getWorkspaceFolders(): string[] {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return [];
    }
    return folders.map(folder => folder.uri.fsPath);
  }

  /**
   * Check if a URI is within any workspace folder
   * @param uri The URI to check
   * @returns True if the URI is within a workspace folder
   */
  static isInWorkspace(uri: vscode.Uri): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return false;
    }

    const filePath = uri.fsPath;
    return workspaceFolders.some(folder => {
      const folderPath = folder.uri.fsPath;
      return filePath.startsWith(folderPath);
    });
  }

  /**
   * Get relative path from workspace root
   * @param uri The URI to get relative path for
   * @returns Relative path or absolute path if not in workspace
   */
  static getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      return path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    }
    return uri.fsPath;
  }

  /**
   * Batch process files with a callback
   * @param files Array of file URIs to process
   * @param batchSize Number of files to process at once
   * @param processor Async function to process each file
   * @param onProgress Optional progress callback
   */
  static async batchProcess<T>(
    files: vscode.Uri[],
    batchSize: number,
    processor: (file: vscode.Uri) => Promise<T>,
    onProgress?: (processed: number, total: number) => void
  ): Promise<T[]> {
    const results: T[] = [];
    let processed = 0;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(file => processor(file)));

      results.push(...batchResults);
      processed += batch.length;

      if (onProgress) {
        onProgress(processed, files.length);
      }
    }

    return results;
  }

  /**
   * Count total lines in a document
   * @param document The document to count lines in
   * @returns Number of lines
   */
  static getLineCount(document: vscode.TextDocument): number {
    return document.lineCount;
  }

  /**
   * Estimate time to process files based on file count and average processing time
   * @param fileCount Number of files to process
   * @param avgTimePerFile Average time per file in milliseconds
   * @returns Estimated time in milliseconds
   */
  static estimateProcessingTime(fileCount: number, avgTimePerFile: number = 100): number {
    return fileCount * avgTimePerFile;
  }

  /**
   * Format file size for display
   * @param bytes File size in bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
