# rumdl - Markdown Linter for VS Code

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/rumdl.rumdl)](https://marketplace.visualstudio.com/items?itemName=rumdl.rumdl)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/rumdl.rumdl)](https://marketplace.visualstudio.com/items?itemName=rumdl.rumdl)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/rumdl.rumdl)](https://marketplace.visualstudio.com/items?itemName=rumdl.rumdl)

A lightning-fast Markdown linter for VS Code powered by [rumdl](https://github.com/rumdl/rumdl), a Rust-based linter with 97.2% markdownlint compatibility and 5x performance improvement.

## Features

✅ **Real-time linting** with 50+ rules and precise column highlighting
✅ **One-click auto-fixes** for common issues
✅ **5x faster** than markdownlint
✅ **Markdownlint compatibility**
✅ **Zero configuration** required
✅ **Workspace-wide linting** support
✅ **Custom rule configuration**
✅ **Status bar integration**
✅ **Precise error positioning** with improved column highlighting (rumdl 0.0.72+)
✅ **Bundled rumdl binary** - no separate installation required
✅ **Cross-platform support** with optimized binaries for all platforms

## Installation

1. **Install the extension** from the VS Code Marketplace
2. **That's it!** rumdl is bundled with the extension - no additional setup required

The extension includes optimized rumdl binaries for all supported platforms:
- Windows (x64)
- macOS (Intel & Apple Silicon)
- Linux (x64 & ARM64)

### Manual Installation (Optional)

If you prefer to use your own rumdl installation:

1. Install rumdl using one of these methods:
   ```bash
   # Using Cargo (Rust)
   cargo install rumdl

   # Using pip (Python)
   pip install rumdl

   # Download binary from GitHub releases
   # See: https://github.com/rvben/rumdl/releases
   ```

2. Configure the path in VS Code settings:
   ```json
   {
     "rumdl.server.path": "/path/to/your/rumdl"
   }
   ```

## Quick Start

1. **Install the extension** from the VS Code Marketplace
2. **Install rumdl** (if not already installed):
   ```bash
   # Using cargo
   cargo install rumdl

   # Using homebrew (macOS)
   brew install rumdl

   # Using npm
   npm install -g rumdl
   ```
3. **Open a Markdown file** - linting starts automatically!

## Screenshots

### Real-time Diagnostics
![Real-time linting with error highlighting](https://via.placeholder.com/800x400/1e1e1e/ffffff?text=Real-time+Diagnostics)

### Quick Fixes
![One-click auto-fixes for common issues](https://via.placeholder.com/800x400/1e1e1e/ffffff?text=Quick+Fixes)

### Status Bar Integration
![Status bar showing server status and rule count](https://via.placeholder.com/800x400/1e1e1e/ffffff?text=Status+Bar)

## Commands

Access these commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **rumdl: Fix all auto-fixable problems** - Apply all available auto-fixes to the current document
- **rumdl: Restart Server** - Restart the rumdl language server
- **rumdl: Show client logs** - View extension logs for debugging
- **rumdl: Show server logs** - View rumdl server logs
- **rumdl: Print debug information** - Print comprehensive debug info to logs

## Configuration

### Extension Settings

Configure rumdl through VS Code settings (`Ctrl+,` / `Cmd+,`):

```json
{
  // Enable/disable rumdl linting
  "rumdl.enable": true,

  // Path to rumdl executable (auto-detected if in PATH)
  "rumdl.server.path": "rumdl",

  // Server log level
  "rumdl.server.logLevel": "info",

  // Rules to enable (empty = all rules)
  "rumdl.rules.select": [],

  // Rules to disable
  "rumdl.rules.ignore": ["MD013", "MD033"],

  // Path to custom configuration file
  "rumdl.configPath": ".rumdl.toml",

  // LSP message tracing (for debugging)
  "rumdl.trace.server": "off"
}
```

### Project Configuration

Create a `.rumdl.toml` file in your project root for project-specific settings:

```toml
# Enable/disable specific rules
[rules]
select = ["MD001", "MD003", "MD022"]
ignore = ["MD013", "MD033"]

# Rule-specific configuration
[rules.MD013]
line_length = 120
code_blocks = false

[rules.MD003]
style = "atx"

# File patterns to include/exclude
[files]
include = ["**/*.md", "**/*.markdown"]
exclude = ["node_modules/**", "target/**"]
```

## Supported File Types

The extension automatically activates for these file extensions:
- `.md`
- `.markdown`
- `.mdown`
- `.mkd`
- `.mdx`

## Performance

rumdl is built for speed:

| Tool | Time (1000 files) | Relative Speed |
|------|-------------------|----------------|
| rumdl | 0.8s | **5x faster** |
| markdownlint | 4.2s | baseline |

## Rule Compatibility

rumdl supports 97.2% of markdownlint rules:

- ✅ **50+ rules** fully implemented
- ✅ **Auto-fixes** for 40+ rules
- ✅ **Custom configuration** support
- ✅ **Same rule IDs** as markdownlint

See the [full rule list](https://github.com/rumdl/rumdl#rules) for details.

## Troubleshooting

### rumdl not found

If you see "rumdl executable not found":

1. **Install rumdl**: Follow the [installation guide](https://github.com/rumdl/rumdl#installation)
2. **Check PATH**: Ensure rumdl is in your system PATH
3. **Set custom path**: Configure `rumdl.server.path` in settings

### Server not starting

If the server fails to start:

1. **Check logs**: Use "rumdl: Show client logs" command
2. **Verify installation**: Run `rumdl --version` in terminal
3. **Restart server**: Use "rumdl: Restart Server" command
4. **Check configuration**: Ensure `.rumdl.toml` is valid

### Performance issues

If linting feels slow:

1. **Check file size**: Very large files (>1MB) may be slower
2. **Exclude patterns**: Add exclusions for generated files
3. **Reduce rules**: Disable unused rules in configuration

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/rumdl/rumdl-vscode.git
cd rumdl-vscode

# Install dependencies
npm install

# Build the extension
npm run compile

# Run in development mode
npm run watch
```

### Testing

```bash
# Run linting
npm run lint
```

## Contributing

We welcome contributions! Please check the repository for contribution guidelines.

### Reporting Issues

When reporting issues, please include:

1. **VS Code version**
2. **Extension version**
3. **rumdl version** (`rumdl --version`)
4. **Debug information** (use "rumdl: Print debug information")
5. **Sample Markdown file** that reproduces the issue

## License

This extension is licensed under the [MIT License](LICENSE).

## Related Projects

- [rumdl](https://github.com/rumdl/rumdl) - The core Rust-based linter
- [markdownlint](https://github.com/DavidAnson/markdownlint) - The original JavaScript linter
- [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) - Command-line interface

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

**Enjoy lightning-fast Markdown linting with rumdl!** ⚡