#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const RUMDL_VERSION = '0.0.91'; // Pin to specific version for consistency
const GITHUB_API_URL = `https://api.github.com/repos/rvben/rumdl/releases/tags/v${RUMDL_VERSION}`;
const BUNDLED_TOOLS_DIR = path.join(__dirname, '..', 'bundled-tools');

// Platform mapping for rumdl binary names
const PLATFORM_MAP = {
  'win32-x64': 'rumdl-x86_64-pc-windows-msvc.exe',
  'darwin-x64': 'rumdl-x86_64-apple-darwin',
  'darwin-arm64': 'rumdl-aarch64-apple-darwin',
  'linux-x64': 'rumdl-x86_64-unknown-linux-gnu',
  'linux-arm64': 'rumdl-aarch64-unknown-linux-gnu'
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

    // Download binaries for all platforms
    const downloadPromises = [];

    for (const [platformKey, binaryName] of Object.entries(PLATFORM_MAP)) {
      const asset = releaseData.assets.find(a => a.name === binaryName);
      if (!asset) {
        console.warn(`Binary not found for platform ${platformKey}: ${binaryName}`);
        continue;
      }

      const destPath = path.join(BUNDLED_TOOLS_DIR, binaryName);
      downloadPromises.push(
        downloadFile(asset.browser_download_url, destPath)
          .then(() => makeExecutable(destPath))
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
  const binaryName = PLATFORM_MAP[platformKey];
  console.log(`🔧 Development mode: Downloading only for current platform: ${platformKey} (${binaryName})`);

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

module.exports = { downloadRumdlBinaries, PLATFORM_MAP, BUNDLED_TOOLS_DIR };