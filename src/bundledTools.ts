import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { Logger } from './utils';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import which = require('which');

interface BundledVersion {
  version: string;
  downloadedAt: string;
  platforms: string[];
}

/**
 * Name of the rumdl binary based on the current platform.
 */
const RUMDL_BINARY_NAME = process.platform === 'win32' ? 'rumdl.exe' : 'rumdl';

/**
 * Common virtual environment directory names to check.
 */
const VENV_DIRS = ['.venv', 'venv'];

/**
 * Get the bin directory name for the current platform.
 * Windows uses 'Scripts', Unix uses 'bin'.
 */
function getVenvBinDir(): string {
  return process.platform === 'win32' ? 'Scripts' : 'bin';
}

export class BundledToolsManager {
  private static readonly BUNDLED_TOOLS_DIR = path.join(__dirname, '..', 'bundled-tools');

  // Primary platform mapping - prefer static (musl) binaries for Linux
  private static readonly PLATFORM_MAP: Record<string, string> = {
    'win32-x64': 'rumdl-x86_64-pc-windows-msvc.exe',
    'darwin-x64': 'rumdl-x86_64-apple-darwin',
    'darwin-arm64': 'rumdl-aarch64-apple-darwin',
    'linux-x64': 'rumdl-x86_64-unknown-linux-musl', // Static binary (preferred)
    'linux-arm64': 'rumdl-aarch64-unknown-linux-musl', // Static binary (preferred)
  };

  // Fallback mapping for Linux platforms (for older releases without musl binaries)
  private static readonly PLATFORM_FALLBACK_MAP: Record<string, string> = {
    'linux-x64': 'rumdl-x86_64-unknown-linux-gnu', // Dynamic binary (fallback)
    'linux-arm64': 'rumdl-aarch64-unknown-linux-gnu', // Dynamic binary (fallback)
  };

  /**
   * Get the current platform key
   */
  private static getPlatformKey(): string {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'win32' && arch === 'x64') {
      return 'win32-x64';
    }
    if (platform === 'darwin' && arch === 'x64') {
      return 'darwin-x64';
    }
    if (platform === 'darwin' && arch === 'arm64') {
      return 'darwin-arm64';
    }
    if (platform === 'linux' && arch === 'x64') {
      return 'linux-x64';
    }
    if (platform === 'linux' && arch === 'arm64') {
      return 'linux-arm64';
    }

    throw new Error(`Unsupported platform: ${platform}-${arch}`);
  }

  /**
   * Check if bundled tools directory exists
   */
  public static hasBundledTools(): boolean {
    return fs.existsSync(this.BUNDLED_TOOLS_DIR);
  }

  /**
   * Get the bundled version information
   */
  public static getBundledVersion(): BundledVersion | null {
    const versionFile = path.join(this.BUNDLED_TOOLS_DIR, 'version.json');

    if (!fs.existsSync(versionFile)) {
      return null;
    }

    try {
      const content = fs.readFileSync(versionFile, 'utf8');
      return JSON.parse(content) as BundledVersion;
    } catch (error) {
      Logger.error(`Failed to read bundled version file: ${error}`);
      return null;
    }
  }

  /**
   * Get the path to the bundled rumdl binary for the current platform
   */
  public static getBundledRumdlPath(): string | null {
    if (!this.hasBundledTools()) {
      return null;
    }

    try {
      const platformKey = this.getPlatformKey();
      const binaryName = this.PLATFORM_MAP[platformKey];

      if (!binaryName) {
        return null;
      }

      let binaryPath = path.join(this.BUNDLED_TOOLS_DIR, binaryName);

      // If primary binary doesn't exist, try fallback for Linux platforms
      if (!fs.existsSync(binaryPath)) {
        const fallbackBinary = this.PLATFORM_FALLBACK_MAP[platformKey];
        if (fallbackBinary) {
          const fallbackPath = path.join(this.BUNDLED_TOOLS_DIR, fallbackBinary);
          if (fs.existsSync(fallbackPath)) {
            binaryPath = fallbackPath;
          } else {
            return null;
          }
        } else {
          return null;
        }
      }

      // Verify the binary is executable (on Unix systems)
      if (process.platform !== 'win32') {
        try {
          const stats = fs.statSync(binaryPath);
          if (!(stats.mode & parseInt('111', 8))) {
            fs.chmodSync(binaryPath, 0o755);
          }
        } catch {
          return null;
        }
      }

      return binaryPath;
    } catch {
      return null;
    }
  }

  /**
   * Find rumdl binary in workspace virtual environments.
   * Checks .venv and venv directories in all workspace folders.
   */
  private static getWorkspaceVenvRumdlPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const binDir = getVenvBinDir();

    for (const folder of workspaceFolders) {
      for (const venvDir of VENV_DIRS) {
        const rumdlPath = path.join(folder.uri.fsPath, venvDir, binDir, RUMDL_BINARY_NAME);
        if (fs.existsSync(rumdlPath)) {
          return rumdlPath;
        }
      }
    }

    return null;
  }

  /**
   * Find rumdl binary in system PATH.
   * This catches homebrew, cargo, mise (if activated), etc.
   */
  private static async getSystemPathRumdlPath(): Promise<string | null> {
    const rumdlPath = await which(RUMDL_BINARY_NAME, { nothrow: true });
    return rumdlPath || null;
  }

  /**
   * Get the best available rumdl path with smart resolution:
   *
   * Resolution order (trusted workspaces):
   * 1. Explicit path setting (user always wins)
   * 2. Workspace venv (.venv/bin/rumdl, venv/bin/rumdl)
   * 3. System PATH (homebrew, cargo, mise if activated, etc.)
   * 4. Bundled binary (guaranteed fallback)
   *
   * For untrusted workspaces, only bundled binary is used (security).
   */
  public static async getBestRumdlPath(configuredPath?: string): Promise<string> {
    // Security: In untrusted workspaces, only use bundled binary
    if (!vscode.workspace.isTrusted) {
      const bundledPath = this.getBundledRumdlPath();
      if (bundledPath) {
        Logger.info(`Untrusted workspace - using bundled rumdl: ${bundledPath}`);
        return bundledPath;
      }
      Logger.warn('Untrusted workspace and no bundled binary available');
      return 'rumdl';
    }

    // 1. Explicit path setting (user always wins)
    if (configuredPath) {
      Logger.info(`Using configured rumdl: ${configuredPath}`);
      return configuredPath;
    }

    // 2. Workspace virtual environment
    const venvPath = this.getWorkspaceVenvRumdlPath();
    if (venvPath) {
      Logger.info(`Using workspace venv rumdl: ${venvPath}`);
      return venvPath;
    }

    // 3. System PATH (homebrew, cargo, mise if activated, etc.)
    const systemPath = await this.getSystemPathRumdlPath();
    if (systemPath) {
      Logger.info(`Using system PATH rumdl: ${systemPath}`);
      return systemPath;
    }

    // 4. Bundled binary (guaranteed fallback)
    const bundledPath = this.getBundledRumdlPath();
    if (bundledPath) {
      const version = this.getBundledVersion();
      Logger.info(`Using bundled rumdl ${version?.version || 'unknown'}: ${bundledPath}`);
      return bundledPath;
    }

    // Last resort
    Logger.warn('No rumdl binary found, falling back to "rumdl" command');
    return 'rumdl';
  }

  /**
   * Log information about available rumdl sources.
   */
  public static logBundledToolsInfo(): void {
    const version = this.getBundledVersion();
    if (version) {
      Logger.info(`Bundled rumdl ${version.version} available`);
    } else {
      Logger.info('No bundled rumdl available');
    }

    // Log resolution order for debugging
    Logger.debug(
      'Resolution order: configured path → workspace venv → system PATH → bundled binary'
    );
  }

  /**
   * Check if bundled binary is available for the current platform.
   */
  public static hasBundledBinary(): boolean {
    return this.getBundledRumdlPath() !== null;
  }
}
