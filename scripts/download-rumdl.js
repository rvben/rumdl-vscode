#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const RUMDL_VERSION = '0.0.215'; // Pin to specific version for consistency
const GITHUB_API_URL = `https://api.github.com/repos/rvben/rumdl/releases/tags/v${RUMDL_VERSION}`;
const BUNDLED_TOOLS_DIR = path.join(__dirname, '..', 'bundled-tools');

// Platform mapping for rumdl binary names and their archive formats
// For Linux, we prefer musl (static) binaries but fall back to gnu (dynamic) for older releases
const PLATFORM_MAP = {
  'win32-x64': { binary: 'rumdl-x86_64-pc-windows-msvc.exe', archive: 'rumdl-v{VERSION}-x86_64-pc-windows-msvc.zip', ext: 'zip' },
  'darwin-x64': { binary: 'rumdl-x86_64-apple-darwin', archive: 'rumdl-v{VERSION}-x86_64-apple-darwin.tar.gz', ext: 'tar.gz' },
  'darwin-arm64': { binary: 'rumdl-aarch64-apple-darwin', archive: 'rumdl-v{VERSION}-aarch64-apple-darwin.tar.gz', ext: 'tar.gz' },
  'linux-x64': { binary: 'rumdl-x86_64-unknown-linux-musl', archive: 'rumdl-v{VERSION}-x86_64-unknown-linux-musl.tar.gz', ext: 'tar.gz' },
  'linux-arm64': { binary: 'rumdl-aarch64-unknown-linux-musl', archive: 'rumdl-v{VERSION}-aarch64-unknown-linux-musl.tar.gz', ext: 'tar.gz' }
};

// Fallback mapping for Linux platforms (for older releases without musl binaries)
const PLATFORM_FALLBACK_MAP = {
  'linux-x64': { binary: 'rumdl-x86_64-unknown-linux-gnu', archive: 'rumdl-v{VERSION}-x86_64-unknown-linux-gnu.tar.gz', ext: 'tar.gz' },
  'linux-arm64': { binary: 'rumdl-aarch64-unknown-linux-gnu', archive: 'rumdl-v{VERSION}-aarch64-unknown-linux-gnu.tar.gz', ext: 'tar.gz' }
};

function getPlatformKey() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32' && arch === 'x64') return 'win32-x64';
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64';

  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} to ${dest}`);

    const file = fs.createWriteStream(dest);
    const request = https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${dest}`);
        resolve();
      });
    });

    request.on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete partial file
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete partial file
      reject(err);
    });
  });
}

function makeExecutable(filePath) {
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o755);
    console.log(`Made executable: ${filePath}`);
  }
}

function extractArchive(archivePath, destDir, binaryName) {
  console.log(`Extracting ${archivePath}...`);
  const ext = path.extname(archivePath);

  try {
    if (ext === '.zip') {
      // Extract zip (cross-platform using unzip or tar)
      if (process.platform === 'win32') {
        execSync(`powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
      } else {
        execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
      }
    } else if (archivePath.endsWith('.tar.gz')) {
      // Extract tar.gz
      execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }

    // Find the extracted binary (could be "rumdl" or "rumdl.exe")
    const extractedName = ext === '.zip' ? 'rumdl.exe' : 'rumdl';
    const extractedPath = path.join(destDir, extractedName);
    const targetPath = path.join(destDir, binaryName);

    // Rename to platform-specific name if needed
    if (extractedName !== binaryName && fs.existsSync(extractedPath)) {
      fs.renameSync(extractedPath, targetPath);
      console.log(`Renamed ${extractedName} to ${binaryName}`);
    }

    // Make the binary executable
    if (fs.existsSync(targetPath)) {
      makeExecutable(targetPath);
    } else {
      throw new Error(`Binary not found after extraction: ${targetPath}`);
    }

    // Clean up archive
    fs.unlinkSync(archivePath);
    console.log(`Extracted and cleaned up: ${archivePath}`);
  } catch (error) {
    console.error(`Failed to extract ${archivePath}:`, error.message);
    throw error;
  }
}

async function downloadRumdlBinaries() {
  try {
    console.log(`Downloading rumdl binaries for version ${RUMDL_VERSION}...`);

    // Create bundled-tools directory
    if (!fs.existsSync(BUNDLED_TOOLS_DIR)) {
      fs.mkdirSync(BUNDLED_TOOLS_DIR, { recursive: true });
    }

    // Get release information
    const releaseData = await new Promise((resolve, reject) => {
      https.get(GITHUB_API_URL, { headers: { 'User-Agent': 'rumdl-vscode' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });

    if (!releaseData.assets) {
      throw new Error('No assets found in release');
    }

    // Download and extract binaries for all platforms
    const downloadPromises = [];

    for (const [platformKey, platformInfo] of Object.entries(PLATFORM_MAP)) {
      const archiveName = platformInfo.archive.replace('{VERSION}', RUMDL_VERSION);
      let asset = releaseData.assets.find(a => a.name === archiveName);
      let actualBinaryName = platformInfo.binary;
      let actualArchiveName = archiveName;

      // If primary archive not found and we have a fallback, try the fallback
      if (!asset && PLATFORM_FALLBACK_MAP[platformKey]) {
        const fallbackInfo = PLATFORM_FALLBACK_MAP[platformKey];
        const fallbackArchiveName = fallbackInfo.archive.replace('{VERSION}', RUMDL_VERSION);
        asset = releaseData.assets.find(a => a.name === fallbackArchiveName);
        if (asset) {
          actualBinaryName = fallbackInfo.binary;
          actualArchiveName = fallbackArchiveName;
          console.log(`Using fallback archive for ${platformKey}: ${fallbackArchiveName}`);
        }
      }

      if (!asset) {
        const fallbackMsg = PLATFORM_FALLBACK_MAP[platformKey]
          ? ` (also tried fallback: ${PLATFORM_FALLBACK_MAP[platformKey].archive.replace('{VERSION}', RUMDL_VERSION)})`
          : '';
        console.warn(`Archive not found for platform ${platformKey}: ${archiveName}${fallbackMsg}`);
        continue;
      }

      const archivePath = path.join(BUNDLED_TOOLS_DIR, actualArchiveName);
      downloadPromises.push(
        downloadFile(asset.browser_download_url, archivePath)
          .then(() => extractArchive(archivePath, BUNDLED_TOOLS_DIR, actualBinaryName))
      );
    }

    await Promise.all(downloadPromises);

    // Create a version file
    const versionFile = path.join(BUNDLED_TOOLS_DIR, 'version.json');
    fs.writeFileSync(versionFile, JSON.stringify({
      version: RUMDL_VERSION,
      downloadedAt: new Date().toISOString(),
      platforms: Object.keys(PLATFORM_MAP)
    }, null, 2));

    console.log(`✅ Successfully downloaded rumdl ${RUMDL_VERSION} binaries for all platforms`);
    console.log(`📁 Binaries saved to: ${BUNDLED_TOOLS_DIR}`);

  } catch (error) {
    console.error('❌ Failed to download rumdl binaries:', error.message);
    process.exit(1);
  }
}

// Allow running specific platform only for development
if (process.argv.includes('--current-platform-only')) {
  const platformKey = getPlatformKey();
  const platformInfo = PLATFORM_MAP[platformKey];
  console.log(`🔧 Development mode: Downloading only for current platform: ${platformKey} (${platformInfo.binary})`);

  // Modify PLATFORM_MAP to only include current platform
  Object.keys(PLATFORM_MAP).forEach(key => {
    if (key !== platformKey) {
      delete PLATFORM_MAP[key];
    }
  });
}

// Add option to update to latest release automatically
if (process.argv.includes('--latest')) {
  console.log('🔍 Checking for latest rumdl release...');
  // This would require fetching the latest release tag from GitHub API
  console.log('ℹ️  Latest release checking not implemented yet. Use --version=x.x.x to specify version.');
}

if (require.main === module) {
  downloadRumdlBinaries();
}

module.exports = { downloadRumdlBinaries, PLATFORM_MAP, PLATFORM_FALLBACK_MAP, BUNDLED_TOOLS_DIR };