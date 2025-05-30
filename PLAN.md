# rumdl VS Code Extension - Comprehensive Development Plan

## Project Overview

This document provides a complete plan for developing a VS Code extension for rumdl, a fast Rust-based Markdown linter with 97.2% markdownlint parity. The extension will provide real-time linting, code actions, and seamless integration with rumdl's Language Server Protocol (LSP) server.

## Context & Background

### Current State
- **rumdl CLI**: Fully functional Rust-based Markdown linter with 50+ rules
- **LSP Server**: Complete implementation with real-time diagnostics, code actions, and configuration support
- **Performance**: 5x faster than markdownlint with comprehensive optimizations
- **Test Coverage**: 24 comprehensive LSP tests (15 unit + 9 integration tests)
- **Version**: 0.0.62 with crash-free operation and no confirmation prompts

### Inspiration: Ruff VS Code Extension
Based on analysis of [astral-sh/ruff-vscode](https://github.com/astral-sh/ruff-vscode), we will follow their proven architecture:
- **TypeScript-based extension** (57.7% TypeScript, 39.4% Python, 1.7% JavaScript)
- **LSP client implementation** connecting to native Rust server
- **Rich configuration options** with VS Code settings integration
- **Professional marketplace presence** with 1.9M+ installs
- **Comprehensive feature set**: diagnostics, code actions, status bar, commands

## Architecture Overview

### Extension Structure
```
rumdl-vscode-extension/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── client.ts             # LSP client implementation
│   ├── commands.ts           # VS Code commands
│   ├── statusBar.ts          # Status bar integration
│   ├── configuration.ts      # Settings management
│   └── utils.ts              # Utility functions
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
├── webpack.config.js         # Bundling configuration
├── .vscodeignore            # Files to exclude from package
├── README.md                # Extension documentation
├── CHANGELOG.md             # Version history
├── icon.png                 # Extension icon (128x128)
└── syntaxes/                # Language definitions (if needed)
```

### Technology Stack
- **Language**: TypeScript (following Ruff's approach)
- **Build System**: Webpack for bundling
- **LSP Client**: VS Code's built-in LSP client
- **Testing**: VS Code extension test framework
- **Packaging**: vsce (Visual Studio Code Extension manager)

## Feature Specifications

### Core Features

#### 1. Real-time Markdown Linting
- **Diagnostics**: Live error/warning highlighting as users type
- **Rule Coverage**: All 50+ rumdl rules with proper categorization
- **Performance**: Leverages rumdl's 5x speed advantage
- **File Support**: `.md`, `.markdown`, `.mdown`, `.mkd`, `.mdx` files

#### 2. Code Actions (Quick Fixes)
- **Auto-fix**: One-click fixes for auto-fixable violations
- **Fix All**: Bulk fix all auto-fixable issues in document
- **Rule-specific Actions**: Targeted fixes per rule type
- **Safe Fixes**: Only apply safe fixes by default (following Ruff's model)

#### 3. Commands
Following Ruff's command structure:
- `rumdl: Fix all auto-fixable problems`
- `rumdl: Restart Server`
- `rumdl: Show client logs`
- `rumdl: Show server logs`
- `rumdl: Print debug information`

#### 4. Configuration Integration
- **VS Code Settings**: Native integration with VS Code preferences
- **rumdl.toml Support**: Automatic detection and respect for project configs
- **Workspace Settings**: Per-workspace configuration overrides
- **Rule Selection**: Enable/disable specific rules via settings

#### 5. Status Bar Integration
- **Server Status**: Show connection status (Connected/Disconnected)
- **Rule Count**: Display active rule count
- **Performance Indicator**: Show linting speed/status
- **Click Actions**: Quick access to logs and settings

### Advanced Features

#### 6. Multi-file Support
- **Workspace Linting**: Lint entire workspace or selected folders
- **File Watching**: Automatic re-linting on file changes
- **Exclude Patterns**: Respect .gitignore and custom exclude patterns

#### 7. Output Channels
- **Client Logs**: Extension-specific logging
- **Server Logs**: rumdl LSP server output
- **Trace Logs**: LSP message tracing for debugging

#### 8. Error Handling
- **Graceful Degradation**: Continue working if server crashes
- **Auto-restart**: Automatic server restart on failures
- **User Notifications**: Clear error messages and recovery suggestions

## Configuration Schema

### Extension Settings (package.json contributions)

```json
{
  "contributes": {
    "configuration": {
      "type": "object",
      "title": "rumdl",
      "properties": {
        "rumdl.enable": {
          "type": "boolean",
          "default": true,
          "description": "Enable rumdl linting"
        },
        "rumdl.configPath": {
          "type": "string",
          "description": "Path to rumdl configuration file"
        },
        "rumdl.rules.select": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Rules to enable"
        },
        "rumdl.rules.ignore": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Rules to disable"
        },
        "rumdl.server.path": {
          "type": "string",
          "description": "Path to rumdl executable"
        },
        "rumdl.server.logLevel": {
          "type": "string",
          "enum": ["error", "warn", "info", "debug", "trace"],
          "default": "info",
          "description": "Log level for rumdl server"
        },
        "rumdl.trace.server": {
          "type": "string",
          "enum": ["off", "messages", "verbose"],
          "default": "off",
          "description": "Trace LSP messages"
        }
      }
    }
  }
}
```

### Language Association
```json
{
  "contributes": {
    "languages": [{
      "id": "markdown",
      "extensions": [".md", ".markdown", ".mdown", ".mkd", ".mdx"]
    }]
  }
}
```

## Implementation Plan

### Phase 1: Core Extension Setup (Week 1)
1. **Project Initialization**
   - Set up TypeScript project with proper tooling
   - Configure webpack bundling
   - Create basic package.json manifest
   - Set up development environment

2. **Basic LSP Client**
   - Implement LSP client connection to rumdl server
   - Basic document synchronization
   - Simple diagnostic display

3. **Extension Activation**
   - Proper activation events for Markdown files
   - Extension lifecycle management
   - Basic error handling

### Phase 2: Core Features (Week 2)
1. **Diagnostics Integration**
   - Full diagnostic mapping from rumdl warnings
   - Proper severity levels (Error/Warning/Info)
   - Line/column positioning accuracy

2. **Code Actions**
   - Implement quick fix actions
   - Fix all functionality
   - Rule-specific action grouping

3. **Commands Implementation**
   - All core commands from specification
   - Command palette integration
   - Keyboard shortcuts

### Phase 3: Advanced Features (Week 3)
1. **Configuration System**
   - VS Code settings integration
   - rumdl.toml file detection and parsing
   - Dynamic configuration updates

2. **Status Bar & UI**
   - Status bar item with server status
   - Click actions and tooltips
   - Progress indicators

3. **Output Channels**
   - Separate channels for client/server logs
   - Trace logging for debugging
   - Log level controls

### Phase 4: Polish & Testing (Week 4)
1. **Error Handling**
   - Robust error recovery
   - User-friendly error messages
   - Auto-restart mechanisms

2. **Testing**
   - Unit tests for core functionality
   - Integration tests with LSP server
   - Manual testing scenarios

3. **Documentation**
   - Comprehensive README
   - Configuration examples
   - Troubleshooting guide

### Phase 5: Marketplace Preparation (Week 5)
1. **Packaging**
   - Icon design and creation
   - Marketplace description
   - Screenshots and demos

2. **Publishing**
   - Publisher account setup
   - Extension validation
   - Initial release (v0.1.0)

## Technical Implementation Details

### LSP Client Implementation

```typescript
// src/client.ts
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

export class RumdlLanguageClient {
  private client: LanguageClient | undefined;

  public async start(): Promise<void> {
    const serverOptions: ServerOptions = {
      command: this.getRumdlPath(),
      args: ['server'],
      transport: TransportKind.stdio
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: 'file', language: 'markdown' }
      ],
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher('**/.rumdl.toml')
      }
    };

    this.client = new LanguageClient(
      'rumdl',
      'rumdl Language Server',
      serverOptions,
      clientOptions
    );

    await this.client.start();
  }

  private getRumdlPath(): string {
    const config = vscode.workspace.getConfiguration('rumdl');
    return config.get('server.path') || 'rumdl';
  }
}
```

### Extension Entry Point

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { RumdlLanguageClient } from './client';
import { StatusBarManager } from './statusBar';
import { CommandManager } from './commands';

let client: RumdlLanguageClient;
let statusBar: StatusBarManager;
let commands: CommandManager;

export async function activate(context: vscode.ExtensionContext) {
  // Initialize components
  client = new RumdlLanguageClient();
  statusBar = new StatusBarManager();
  commands = new CommandManager(client);

  // Start LSP client
  try {
    await client.start();
    statusBar.setConnected();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to start rumdl server: ${error}`);
    statusBar.setDisconnected();
  }

  // Register commands
  commands.register(context);

  // Show status bar
  statusBar.show();
  context.subscriptions.push(statusBar);
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
```

### Configuration Management

```typescript
// src/configuration.ts
import * as vscode from 'vscode';

export class ConfigurationManager {
  public static getConfiguration(): RumdlConfig {
    const config = vscode.workspace.getConfiguration('rumdl');

    return {
      enable: config.get('enable', true),
      configPath: config.get('configPath'),
      rules: {
        select: config.get('rules.select', []),
        ignore: config.get('rules.ignore', [])
      },
      server: {
        path: config.get('server.path', 'rumdl'),
        logLevel: config.get('server.logLevel', 'info')
      },
      trace: {
        server: config.get('trace.server', 'off')
      }
    };
  }

  public static onConfigurationChanged(
    callback: (config: RumdlConfig) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('rumdl')) {
        callback(this.getConfiguration());
      }
    });
  }
}

interface RumdlConfig {
  enable: boolean;
  configPath?: string;
  rules: {
    select: string[];
    ignore: string[];
  };
  server: {
    path: string;
    logLevel: string;
  };
  trace: {
    server: string;
  };
}
```

## Package.json Manifest

```json
{
  "name": "rumdl",
  "displayName": "rumdl - Markdown Linter",
  "description": "Fast Rust-based Markdown linter with real-time diagnostics and auto-fixes",
  "version": "0.1.0",
  "publisher": "rumdl",
  "license": "MIT",
  "icon": "icon.png",
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Linters",
    "Other"
  ],
  "keywords": [
    "markdown",
    "linter",
    "rust",
    "fast",
    "markdownlint"
  ],
  "activationEvents": [
    "onLanguage:markdown"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "languages": [{
      "id": "markdown",
      "extensions": [".md", ".markdown", ".mdown", ".mkd", ".mdx"]
    }],
    "commands": [
      {
        "command": "rumdl.fixAll",
        "title": "Fix all auto-fixable problems",
        "category": "rumdl"
      },
      {
        "command": "rumdl.restartServer",
        "title": "Restart Server",
        "category": "rumdl"
      }
    ],
    "configuration": {
      "type": "object",
      "title": "rumdl",
      "properties": {
        "rumdl.enable": {
          "type": "boolean",
          "default": true,
          "description": "Enable rumdl linting"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "webpack --mode production",
    "watch": "webpack --mode development --watch",
    "test": "node ./out/test/runTest.js"
  },
  "devDependencies": {
    "@types/vscode": "^1.74.0",
    "@types/node": "16.x",
    "typescript": "^4.9.4",
    "webpack": "^5.75.0",
    "webpack-cli": "^5.0.1"
  },
  "dependencies": {
    "vscode-languageclient": "^8.0.2"
  }
}
```

## Testing Strategy

### Unit Tests
- Configuration management
- Command registration
- Status bar updates
- Error handling

### Integration Tests
- LSP client connection
- Document synchronization
- Diagnostic reporting
- Code action execution

### Manual Testing Scenarios
1. **Basic Functionality**
   - Open Markdown file → See diagnostics
   - Apply quick fix → Verify fix applied
   - Run "Fix All" → Verify all fixes applied

2. **Configuration**
   - Change settings → Verify server restart
   - Add rumdl.toml → Verify config respected
   - Disable extension → Verify no diagnostics

3. **Error Scenarios**
   - Server crash → Verify auto-restart
   - Invalid config → Verify error message
   - Missing rumdl binary → Verify graceful failure

## Marketplace Strategy

### Branding
- **Name**: "rumdl - Markdown Linter"
- **Icon**: Clean, modern design with Markdown + speed theme
- **Colors**: Professional blue/gray palette
- **Tagline**: "Lightning-fast Markdown linting with auto-fixes"

### Description
```
rumdl is an extremely fast Markdown linter written in Rust, providing real-time
diagnostics and auto-fixes for your Markdown files. With 97.2% markdownlint
compatibility and 5x performance improvement, rumdl helps you write better
Markdown faster.

Features:
✅ Real-time linting with 50+ rules
✅ One-click auto-fixes
✅ 5x faster than markdownlint
✅ Full markdownlint compatibility
✅ Zero configuration required
✅ Workspace-wide linting support
```

### Keywords
- markdown, linter, rust, fast, markdownlint, auto-fix, real-time, diagnostics

### Screenshots
1. Real-time diagnostics in action
2. Quick fix menu demonstration
3. Settings configuration panel
4. Status bar integration

## Success Metrics

### Technical Metrics
- **Performance**: < 100ms diagnostic response time
- **Reliability**: < 1% crash rate
- **Compatibility**: 100% VS Code API compliance

### User Metrics
- **Adoption**: 1,000+ installs in first month
- **Rating**: 4.5+ stars average
- **Engagement**: 80%+ weekly active users

### Quality Metrics
- **Test Coverage**: 90%+ code coverage
- **Documentation**: Complete API documentation
- **Support**: < 24h issue response time

## Risk Mitigation

### Technical Risks
1. **LSP Server Crashes**
   - Mitigation: Auto-restart with exponential backoff
   - Fallback: Graceful degradation to basic text editing

2. **Performance Issues**
   - Mitigation: Debounced diagnostics, incremental updates
   - Monitoring: Performance telemetry and optimization

3. **Configuration Conflicts**
   - Mitigation: Clear precedence rules, validation
   - Documentation: Comprehensive configuration guide

### Market Risks
1. **Competition from markdownlint-cli2**
   - Differentiation: Superior performance and user experience
   - Value proposition: "5x faster with same rules"

2. **VS Code API Changes**
   - Mitigation: Follow VS Code extension best practices
   - Monitoring: Track VS Code release notes and deprecations

## Future Enhancements

### Phase 2 Features (v0.2.0)
- **Custom Rules**: Support for user-defined rules
- **Rule Documentation**: In-editor rule explanations
- **Batch Processing**: Multi-file fix operations

### Phase 3 Features (v0.3.0)
- **Integration**: GitHub Actions, pre-commit hooks
- **Analytics**: Usage statistics and optimization insights
- **Themes**: Customizable diagnostic styling

### Long-term Vision
- **Ecosystem**: Plugin marketplace for custom rules
- **AI Integration**: Smart fix suggestions
- **Collaboration**: Team-wide configuration sharing

## Conclusion

This comprehensive plan provides a roadmap for creating a professional-grade VS Code extension for rumdl. By following Ruff's proven architecture and focusing on performance, reliability, and user experience, we can deliver a superior Markdown linting solution that leverages rumdl's technical advantages.

The phased approach ensures steady progress while maintaining quality, and the detailed technical specifications provide clear implementation guidance for any developer picking up this project.

**Next Steps**: Begin Phase 1 implementation with project setup and basic LSP client integration.