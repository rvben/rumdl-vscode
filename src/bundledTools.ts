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

  // Primary npm scope-package mapping for node_modules detection.
  // Linux prefers the musl (static) variant, matching the PLATFORM_MAP strategy.
  private static readonly NPM_PLATFORM_MAP: Record<string, string> = {
    'win32-x64': '@rumdl/cli-win32-x64',
    'darwin-x64': '@rumdl/cli-darwin-x64',
    'darwin-arm64': '@rumdl/cli-darwin-arm64',
    'linux-x64': '@rumdl/cli-linux-x64-musl', // Static binary (preferred)
    'linux-arm64': '@rumdl/cli-linux-arm64-musl', // Static binary (preferred)
  };

  // Fallback npm scope-package mapping for Linux platforms without musl packages.
  private static readonly NPM_PLATFORM_FALLBACK_MAP: Record<string, string | undefined> = {
    'linux-x64': '@rumdl/cli-linux-x64', // GNU variant (fallback)
    'linux-arm64': '@rumdl/cli-linux-arm64', // GNU variant (fallback)
  };

  /**
   * Compute the platform key for a given (platform, arch) pair.
   *
   * Returns null for unsupported combinations rather than throwing, so callers
   * (notably the node_modules resolver) can degrade gracefully on platforms
   * for which we ship no native binary.
   */
  private static computePlatformKey(platform: NodeJS.Platform, arch: string): string | null {
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
    return null;
  }

  /**
   * Get the platform key for the current process.
   */
  private static getPlatformKey(): string {
    const key = this.computePlatformKey(process.platform, process.arch);
    if (!key) {
      throw new Error(`Unsupported platform: ${process.platform}-${process.arch}`);
    }
    return key;
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
   * Build the ordered list of candidate paths to probe for a node_modules-installed rumdl.
   *
   * Pure function (no fs access, no process globals) so the per-platform priority
   * can be unit-tested without mutating process.platform.
   *
   * Priority (per workspace folder):
   *   1. node_modules/<npm-scope-pkg>/<binary>          — native platform binary
   *   2. node_modules/<npm-scope-pkg-fallback>/<binary> — Linux GNU fallback
   *   3. node_modules/.bin/rumdl                        — Unix only
   *   4. node_modules/rumdl/bin/rumdl                   — Unix only (JS wrapper)
   *
   * On Windows, candidates 3 and 4 are omitted: the .bin/rumdl.cmd shim and the
   * JS wrapper both require `shell: true` to spawn, which LanguageClient does
   * not set. Returning such a path would fail to launch, so we fall through to
   * system PATH / bundled binary instead.
   *
   * The native binary lives at the package root (not under bin/) — see
   * @rumdl/cli-* package layout in the rumdl repo.
   */
  private static buildNodeModulesCandidates(
    workspaceRoot: string,
    platform: NodeJS.Platform,
    arch: string
  ): string[] {
    const candidates: string[] = [];
    const isWindows = platform === 'win32';
    const nativeBinaryName = isWindows ? 'rumdl.exe' : 'rumdl';
    const platformKey = this.computePlatformKey(platform, arch);

    if (platformKey) {
      const primary = this.NPM_PLATFORM_MAP[platformKey];
      if (primary) {
        candidates.push(path.join(workspaceRoot, 'node_modules', primary, nativeBinaryName));
      }
      const fallback = this.NPM_PLATFORM_FALLBACK_MAP[platformKey];
      if (fallback) {
        candidates.push(path.join(workspaceRoot, 'node_modules', fallback, nativeBinaryName));
      }
    }

    // On Unix, the .bin symlink and the JS wrapper both have shebangs and can be
    // spawned directly. On Windows, neither can be spawned without `shell: true`,
    // so omit them entirely rather than returning an unlaunchable path.
    if (!isWindows) {
      candidates.push(path.join(workspaceRoot, 'node_modules', '.bin', 'rumdl'));
      candidates.push(path.join(workspaceRoot, 'node_modules', 'rumdl', 'bin', 'rumdl'));
    }

    return candidates;
  }

  /**
   * Find rumdl binary installed via npm, yarn, or pnpm in workspace node_modules.
   *
   * Walks workspace folders in order and returns the first existing candidate.
   * See {@link buildNodeModulesCandidates} for the per-platform probe order.
   */
  private static getWorkspaceNodeModulesRumdlPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    for (const folder of workspaceFolders) {
      const candidates = this.buildNodeModulesCandidates(
        folder.uri.fsPath,
        process.platform,
        process.arch
      );
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Resolve an explicitly configured rumdl path.
   *
   * Plain command names such as `rumdl` are left untouched so users can opt into
   * PATH resolution. Path-like relative values such as `.venv/bin/rumdl` or
   * `tools/rumdl` are resolved against the first workspace folder, matching the
   * working directory used for the language server.
   */
  private static resolveConfiguredRumdlPath(configuredPath: string): string {
    const trimmedPath = configuredPath.trim();

    if (path.isAbsolute(trimmedPath)) {
      return trimmedPath;
    }

    const isPathLike =
      trimmedPath.startsWith('.') ||
      trimmedPath.includes('/') ||
      trimmedPath.includes(path.win32.sep);

    if (!isPathLike) {
      return trimmedPath;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const basePath = workspaceFolder?.uri.fsPath || process.cwd();
    return path.resolve(basePath, trimmedPath);
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
   * 3. Workspace node_modules (npm/yarn/pnpm install rumdl)
   * 4. System PATH (homebrew, cargo, mise if activated, etc.)
   * 5. Bundled binary (guaranteed fallback)
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
      const resolvedPath = this.resolveConfiguredRumdlPath(configuredPath);
      Logger.info(`Using configured rumdl: ${resolvedPath}`);
      return resolvedPath;
    }

    // 2. Workspace virtual environment
    const venvPath = this.getWorkspaceVenvRumdlPath();
    if (venvPath) {
      Logger.info(`Using workspace venv rumdl: ${venvPath}`);
      return venvPath;
    }

    // 3. Workspace node_modules (npm/yarn/pnpm install rumdl)
    const nodeModulesPath = this.getWorkspaceNodeModulesRumdlPath();
    if (nodeModulesPath) {
      Logger.info(`Using workspace node_modules rumdl: ${nodeModulesPath}`);
      return nodeModulesPath;
    }

    // 4. System PATH (homebrew, cargo, mise if activated, etc.)
    const systemPath = await this.getSystemPathRumdlPath();
    if (systemPath) {
      Logger.info(`Using system PATH rumdl: ${systemPath}`);
      return systemPath;
    }

    // 5. Bundled binary (guaranteed fallback)
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
      'Resolution order: configured path → workspace venv → workspace node_modules → system PATH → bundled binary'
    );
  }

  /**
   * Check if bundled binary is available for the current platform.
   */
  public static hasBundledBinary(): boolean {
    return this.getBundledRumdlPath() !== null;
  }
}
