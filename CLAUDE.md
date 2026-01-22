# Claude Instructions for rumdl-vscode

## VS Code Engine Compatibility

**CRITICAL**: When updating `@types/vscode`, you MUST also update `engines.vscode` to match, and vice versa.

The `vsce` packaging tool validates that `@types/vscode` version is NOT greater than `engines.vscode`. If they mismatch, the release will fail with:

```
@types/vscode ^X.Y.Z greater than engines.vscode ^A.B.C
```

### Cursor/Windsurf/VSCodium Compatibility

These VS Code forks are built on older VS Code versions:
- **Cursor**: Based on VS Code ~1.93
- **VSCodium**: Varies, often behind latest

The extension marketplace only shows versions compatible with the editor's base VS Code version. If `engines.vscode` is set too high, users on these editors will be stuck on old versions.

### Current Requirements (as of v0.0.144)

```json
{
  "engines": {
    "vscode": "^1.82.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.82.0"
  }
}
```

The actual minimum is `^1.82.0` (from `vscode-languageclient@9.0.1`).

### Before Bumping VS Code Version

1. Check if the extension actually uses any new APIs from that version
2. Consider impact on Cursor/VSCodium users
3. Always update BOTH `engines.vscode` AND `@types/vscode` together
4. Test with `npx vsce ls` to validate packaging

### Reference

- Issue: https://github.com/rvben/rumdl/issues/326
- Cursor compatibility issue: https://github.com/cursor/cursor/issues/1602
