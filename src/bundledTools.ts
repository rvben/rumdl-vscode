import * as path from 'path';
import * as fs from 'fs';
import { Logger } from './utils';

interface BundledVersion {
  version: string;
  downloadedAt: string;
  platforms: string[];
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
      let binaryName = this.PLATFORM_MAP[platformKey];
      let binaryPath = path.join(this.BUNDLED_TOOLS_DIR, binaryName);

      if (!binaryName) {
        Logger.warn(`No bundled binary available for platform: ${platformKey}`);
        return null;
      }

      // If primary binary doesn't exist, try fallback for Linux platforms
      if (!fs.existsSync(binaryPath) && this.PLATFORM_FALLBACK_MAP[platformKey]) {
        const fallbackBinary = this.PLATFORM_FALLBACK_MAP[platformKey];
        const fallbackPath = path.join(this.BUNDLED_TOOLS_DIR, fallbackBinary);

        if (fs.existsSync(fallbackPath)) {
          Logger.info(`Using fallback binary for ${platformKey}: ${fallbackBinary}`);
          binaryName = fallbackBinary;
          binaryPath = fallbackPath;
        } else {
          Logger.warn(`Neither primary nor fallback binary found for ${platformKey}`);
          Logger.warn(`  Primary: ${binaryPath}`);
          Logger.warn(`  Fallback: ${fallbackPath}`);
          return null;
        }
      }

      if (!fs.existsSync(binaryPath)) {
        Logger.warn(`Bundled binary not found: ${binaryPath}`);
        return null;
      }

      // Verify the binary is executable (on Unix systems)
      if (process.platform !== 'win32') {
        try {
          const stats = fs.statSync(binaryPath);
          if (!(stats.mode & parseInt('111', 8))) {
            Logger.warn(`Bundled binary is not executable: ${binaryPath}`);
            // Try to make it executable
            fs.chmodSync(binaryPath, 0o755);
            Logger.info(`Made bundled binary executable: ${binaryPath}`);
          }
        } catch (error) {
          Logger.error(`Failed to check/set executable permissions: ${error}`);
          return null;
        }
      }

      Logger.info(`Found bundled rumdl binary: ${binaryPath}`);
      return binaryPath;
    } catch (error) {
      Logger.error(`Failed to get bundled rumdl path: ${error}`);
      return null;
    }
  }

  /**
   * Get the best available rumdl path (bundled first, then system)
   */
  public static async getBestRumdlPath(configuredPath?: string): Promise<string> {
    // 1. Use explicitly configured path if provided
    if (configuredPath) {
      Logger.info(`Using configured rumdl path: ${configuredPath}`);
      return configuredPath;
    }

    // 2. Try bundled binary first
    const bundledPath = this.getBundledRumdlPath();
    if (bundledPath) {
      const version = this.getBundledVersion();
      Logger.info(`Using bundled rumdl ${version?.version || 'unknown'}: ${bundledPath}`);
      return bundledPath;
    }

    // 3. Fall back to system rumdl
    Logger.info('No bundled rumdl found, falling back to system rumdl');
    return 'rumdl';
  }

  /**
   * Log information about bundled tools
   */
  public static logBundledToolsInfo(): void {
    if (!this.hasBundledTools()) {
      Logger.info('No bundled tools found - will use system rumdl');
      return;
    }

    const version = this.getBundledVersion();
    if (version) {
      Logger.info(
        `Bundled tools available: rumdl ${version.version} (downloaded ${version.downloadedAt})`
      );
      Logger.info(`Supported platforms: ${version.platforms.join(', ')}`);
    }

    const currentPlatformBinary = this.getBundledRumdlPath();
    if (currentPlatformBinary) {
      Logger.info(`Current platform binary: ${currentPlatformBinary}`);
    } else {
      Logger.warn(`No bundled binary available for current platform: ${this.getPlatformKey()}`);
    }
  }

  /**
   * Check if we should prefer bundled tools over system tools
   */
  public static shouldPreferBundled(): boolean {
    // Always prefer bundled if available for consistency
    return this.getBundledRumdlPath() !== null;
  }
}
