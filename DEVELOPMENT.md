# Development Guide

This guide explains how to develop and test the rumdl VS Code extension.

## Prerequisites

- Node.js 16+ and npm
- VS Code
- TypeScript knowledge
- rumdl CLI tool (for testing)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/rumdl/rumdl-vscode.git
   cd rumdl-vscode
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run compile
   ```

## Development Workflow

### Building

- **Development build**: `npm run compile:dev`
- **Production build**: `npm run compile`
- **Watch mode**: `npm run watch`

### Testing

1. Open the project in VS Code
2. Press `F5` to launch a new Extension Development Host window
3. Open a Markdown file in the new window
4. The extension should activate automatically

### Debugging

- Use VS Code's built-in debugger
- Set breakpoints in TypeScript files
- Use the Debug Console to inspect variables
- Check the Output panel for logs:
  - "rumdl Client" - Extension logs
  - "rumdl Language Server" - Server logs

### Code Quality

- **Linting**: `npm run lint`
- **Type checking**: TypeScript compiler will catch type errors

## Architecture

### Core Components

1. **Extension (`src/extension.ts`)**: Main entry point
2. **LSP Client (`src/client.ts`)**: Communicates with rumdl server
3. **Configuration (`src/configuration.ts`)**: Manages settings
4. **Commands (`src/commands.ts`)**: VS Code command handlers
5. **Status Bar (`src/statusBar.ts`)**: UI status indicator
6. **Utils (`src/utils.ts`)**: Shared utilities

### Key Features

- **Real-time diagnostics**: Via LSP protocol
- **Auto-fixes**: Code actions from server
- **Configuration**: VS Code settings + .rumdl.toml
- **Error handling**: Graceful degradation and recovery

## Testing the Extension

### Manual Testing

1. Create test Markdown files with various issues
2. Verify diagnostics appear in real-time
3. Test quick fixes and "Fix All" command
4. Test configuration changes
5. Test server restart functionality

### Common Test Scenarios

1. **Server not installed**: Extension should show helpful error
2. **Configuration changes**: Server should restart automatically
3. **Large files**: Performance should remain good
4. **Invalid config**: Should handle gracefully

## Packaging

To create a `.vsix` package:

```bash
npm run package
```

This creates a `rumdl-X.X.X.vsix` file that can be installed in VS Code.

## Publishing

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create package: `npm run package`
4. Publish to marketplace (requires publisher account)

## Troubleshooting

### Common Issues

1. **TypeScript errors**: Check `tsconfig.json` and dependencies
2. **Webpack build fails**: Check `webpack.config.js`
3. **Extension not activating**: Check `activationEvents` in `package.json`
4. **LSP not connecting**: Verify rumdl server is available

### Debug Commands

- `rumdl: Show client logs` - Extension logs
- `rumdl: Show server logs` - Server logs
- `rumdl: Print debug information` - Full debug info

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test thoroughly
4. Submit a pull request

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Use meaningful variable names

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [rumdl Documentation](https://github.com/rumdl/rumdl)