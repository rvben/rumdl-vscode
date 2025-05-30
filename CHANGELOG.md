# Changelog

All notable changes to the rumdl VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5] - 2025-05-29

### Added
- **Bundled rumdl binary**: Extension now includes rumdl 0.0.72 binaries for all platforms
- **Zero-setup experience**: No need to install rumdl separately - works out of the box
- **Cross-platform support**: Optimized binaries for Windows, macOS (Intel & Apple Silicon), and Linux (x64 & ARM64)
- **Automatic binary selection**: Extension automatically chooses the correct binary for your platform
- **Fallback support**: Gracefully falls back to system rumdl if bundled binary is not available
- **New command**: "rumdl: Check Extension Status" - provides detailed status information in a user-friendly dialog

### Improved
- **Latest rumdl version**: Updated to rumdl 0.0.72 with latest improvements and bug fixes
- **Better error messages**: More helpful error messages when rumdl is not found
- **Enhanced logging**: Better visibility into which rumdl binary is being used
- **Startup performance**: Faster extension activation with bundled binaries
- **Extension visibility**: Fixed missing output channel initialization - logs are now properly visible
- **Status checking**: Added comprehensive status check command to help users verify extension is working
- **Improved error handling**: Better error messages with options to view logs when issues occur
- **Enhanced status bar**: More informative status bar messages showing extension state

### Technical
- Added `BundledToolsManager` for handling bundled binary detection and selection
- Added download script for fetching rumdl binaries during build process
- Updated build process to include bundled tools in extension package

## [0.1.4] - 2025-01-25

### Improved
- Enhanced compatibility with rumdl 0.0.69 which provides significantly improved column highlighting precision
- Better diagnostic positioning and highlighting accuracy for more precise error location

## [0.1.3] - 2025-01-25

### Added
- rumdl version logging: The extension now logs the rumdl version during startup for easier debugging
- Enhanced debug information: The "Print debug information" command now includes the rumdl version
- Duplicate diagnostics detection and deduplication: New setting `rumdl.diagnostics.deduplicate` to automatically remove duplicate diagnostics
- New command "Check for duplicate diagnostics" to help diagnose issues with multiple markdown linters

### Fixed
- Addressed potential duplicate diagnostic issues that could occur when multiple markdown linters are active
- Added diagnostic collection name to prevent conflicts with other extensions

## [0.1.2] - 2025-01-25

### Fixed
- Fixed server startup failure caused by invalid `--log-level` argument
- Updated server arguments to use `--verbose` flag for debug logging (compatible with rumdl server)
- Removed unsupported `--log-level` argument that was causing server connection failures

## [0.1.1] - 2025-01-25

### Fixed
- Fixed critical bug where extension would fail to start with "The argument 'file' cannot be empty" error
- Added validation to ensure rumdl executable path is never empty
- Improved error handling and debugging for configuration issues
- Added detailed logging for rumdl path resolution

## [0.1.0] - 2025-01-25

### Added
- Initial release of rumdl VS Code extension
- Real-time Markdown linting with LSP integration
- Auto-fix capabilities via code actions
- Command palette integration with 5 core commands:
  - Fix all auto-fixable problems
  - Restart server
  - Show client logs
  - Show server logs
  - Print debug information
- Status bar integration showing server status
- Comprehensive configuration support:
  - VS Code settings integration
  - .rumdl.toml project configuration
  - Rule selection and ignoring
  - Custom executable path
  - Log level configuration
- File watching for configuration changes
- Error handling with graceful degradation
- Auto-restart with exponential backoff
- Support for multiple Markdown file extensions (.md, .markdown, .mdown, .mkd, .mdx)

### Technical
- TypeScript implementation with strict mode
- Webpack bundling for optimized performance
- ESLint configuration for code quality
- Comprehensive documentation and development guide

## [0.0.1] - Development

### Added
- **Project setup and initial architecture**
- **Basic LSP client implementation**
- **Core extension structure**