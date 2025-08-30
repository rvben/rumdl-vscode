# Format on Save

rumdl supports automatic formatting of Markdown files when you save them. There are two ways to enable this feature:

## Method 1: Using VSCode's Built-in Format on Save (Recommended)

Enable VSCode's built-in format on save feature in your settings:

```json
{
  "editor.formatOnSave": true
}
```

Or via the settings UI:
1. Open Settings (Cmd+, on Mac, Ctrl+, on Windows/Linux)
2. Search for "format on save"
3. Check the "Editor: Format On Save" checkbox

This will use rumdl's formatter to automatically fix issues when you save Markdown files.

## Method 2: Using rumdl's Auto-Fix on Save

Enable rumdl's specific auto-fix on save feature:

```json
{
  "rumdl.format.autoFixOnSave": true
}
```

This setting allows rumdl to automatically fix issues when saving Markdown files.

## What Gets Fixed

When format on save is enabled, rumdl will automatically fix:
- Missing spaces after heading markers (MD018)
- Trailing spaces (MD009)
- List marker spacing issues (MD030)
- Missing final newlines (MD047)
- And many other auto-fixable issues

## Testing

To verify format on save is working:
1. Create a Markdown file with issues:
   ```markdown
   #Missing space
   
   Trailing spaces   
   ```
2. Save the file (Cmd+S / Ctrl+S)
3. The file should be automatically fixed:
   ```markdown
   # Missing space
   
   Trailing spaces
   ```