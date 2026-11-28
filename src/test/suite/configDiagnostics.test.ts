import * as vscode from 'vscode';
import { expect } from '../helper';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('ConfigDiagnostics Tests', () => {
  let testDir: string;

  setup(() => {
    // Create a temporary directory for test files
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumdl-test-'));
  });

  teardown(() => {
    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  async function diagnostics(uri: vscode.Uri, count: number) {
    for (let i = 0; i < 100; i++) {
      const result = vscode.languages.getDiagnostics(uri).filter(d => d.source === 'rumdl');
      if (result.length === count) {
        return result;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(
      `Expected ${count} rumdl diagnostics: ${vscode.languages.getDiagnostics(uri).map(d => d.message)}`
    );
  }

  test('editing a TOML rule selector publishes and clears the exact diagnostic', async () => {
    const configPath = path.join(testDir, '.rumdl.toml');
    const invalid = 'enable = ["AL"]';
    fs.writeFileSync(configPath, `[global]\n${invalid}\nextend-enable = ["ALL", "MD001"]\n`);
    await vscode.extensions.getExtension('rvben.rumdl')!.activate();
    const doc = await vscode.workspace.openTextDocument(configPath);
    const editor = await vscode.window.showTextDocument(doc);

    try {
      const [typo] = await diagnostics(doc.uri, 1);
      expect(typo.message).to.equal("Unknown rule 'AL' in 'enable'");
      expect(typo.range.isEqual(doc.lineAt(1).range)).to.be.true;
      expect(await editor.edit(edit => edit.replace(doc.lineAt(1).range, 'enable = ["ALL"]'))).to.be
        .true;
      await diagnostics(doc.uri, 0);
      expect(await editor.edit(edit => edit.replace(doc.lineAt(1).range, invalid))).to.be.true;
      await diagnostics(doc.uri, 1);
      await doc.save();
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      const deletion = new vscode.WorkspaceEdit();
      deletion.deleteFile(doc.uri);
      expect(await vscode.workspace.applyEdit(deletion)).to.be.true;
    }
    await diagnostics(doc.uri, 0);
  });

  test('rapid edits refresh diagnostics independently for both config documents', async () => {
    await vscode.extensions.getExtension('rvben.rumdl')!.activate();
    const files = [
      ['.rumdl.toml', '[global]'],
      ['pyproject.toml', '[tool.rumdl]'],
    ];
    const docs = await Promise.all(
      files.map(async ([name, section]) => {
        const file = path.join(testDir, name);
        fs.writeFileSync(file, `${section}\nenable = ["AL"]\n`);
        return vscode.workspace.openTextDocument(file);
      })
    );
    await Promise.all(docs.map(doc => diagnostics(doc.uri, 1)));
    const change = new vscode.WorkspaceEdit();
    change.replace(docs[0].uri, docs[0].lineAt(1).range, 'enable = ["ALL"]');
    change.replace(docs[1].uri, docs[1].lineAt(0).range, '[tool.other]');
    expect(await vscode.workspace.applyEdit(change)).to.be.true;
    await Promise.all(docs.map(doc => diagnostics(doc.uri, 0)));
    const invalidate = new vscode.WorkspaceEdit();
    invalidate.replace(docs[0].uri, docs[0].lineAt(1).range, 'enable = ["AL"]');
    expect(await vscode.workspace.applyEdit(invalidate)).to.be.true;
    await diagnostics(docs[0].uri, 1);
    await Promise.all(docs.map(doc => doc.save()));
    const deletion = new vscode.WorkspaceEdit();
    deletion.deleteFile(vscode.Uri.file(testDir), { recursive: true });
    expect(await vscode.workspace.applyEdit(deletion)).to.be.true;
    await diagnostics(docs[0].uri, 0);
  });

  test('should validate default .rumdl.toml config without errors', async () => {
    const configPath = path.join(testDir, '.rumdl.toml');
    const defaultConfig = `# rumdl configuration file

[global]
exclude = [
    ".git",
    ".github",
    "node_modules",
    "vendor",
    "dist",
    "build",
    "CHANGELOG.md",
    "LICENSE.md",
]

respect_gitignore = true
`;

    fs.writeFileSync(configPath, defaultConfig);

    const doc = await vscode.workspace.openTextDocument(configPath);

    // Wait a bit for diagnostics to be computed
    await new Promise(resolve => setTimeout(resolve, 500));

    const updatedDiagnostics = vscode.languages.getDiagnostics(doc.uri);

    expect(updatedDiagnostics).to.be.an('array');
    // Filter out any non-rumdl diagnostics
    const rumdlDiagnostics = updatedDiagnostics.filter(d => d.source === 'rumdl');
    expect(rumdlDiagnostics).to.be.empty;
  });

  test('should validate pyproject.toml with [tool.rumdl] section', async () => {
    const configPath = path.join(testDir, 'pyproject.toml');
    const pyprojectContent = `[build-system]
requires = ["setuptools>=42", "wheel"]
build-backend = "setuptools.build_meta"

[tool.rumdl]
disable = ["MD033"]
exclude = [
    "node_modules",
    "vendor",
    ".git"
]
respect_gitignore = true

[tool.rumdl.MD013]
line_length = 120
code_blocks = false
`;

    fs.writeFileSync(configPath, pyprojectContent);

    const doc = await vscode.workspace.openTextDocument(configPath);

    // Wait a bit for diagnostics to be computed
    await new Promise(resolve => setTimeout(resolve, 500));

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);

    expect(diagnostics).to.be.an('array');
    // Filter out any non-rumdl diagnostics
    const rumdlDiagnostics = diagnostics.filter(d => d.source === 'rumdl');
    expect(rumdlDiagnostics).to.be.empty;
  });

  test('should validate pyproject.toml [tool.rumdl.per-file-ignores] without errors (issue #157)', async () => {
    const configPath = path.join(testDir, 'pyproject.toml');
    const pyprojectContent = `[tool.rumdl]
line-length = 100

[tool.rumdl.per-file-ignores]
"README.md" = ["MD033"]
"docs/api/**/*.md" = ["MD013", "MD041"]
`;

    fs.writeFileSync(configPath, pyprojectContent);

    const doc = await vscode.workspace.openTextDocument(configPath);

    // Wait a bit for diagnostics to be computed
    await new Promise(resolve => setTimeout(resolve, 500));

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    const rumdlDiagnostics = diagnostics.filter(d => d.source === 'rumdl');
    expect(
      rumdlDiagnostics,
      `unexpected diagnostics: ${rumdlDiagnostics.map(d => d.message).join('; ')}`
    ).to.be.empty;
  });

  test('should validate pyproject.toml [tool.rumdl.per-file-flavor] without errors', async () => {
    const configPath = path.join(testDir, 'pyproject.toml');
    const pyprojectContent = `[tool.rumdl.per-file-flavor]
"docs/mkdocs/**/*.md" = "mkdocs"
"README.md" = "gfm"
`;

    fs.writeFileSync(configPath, pyprojectContent);

    const doc = await vscode.workspace.openTextDocument(configPath);

    // Wait a bit for diagnostics to be computed
    await new Promise(resolve => setTimeout(resolve, 500));

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    const rumdlDiagnostics = diagnostics.filter(d => d.source === 'rumdl');
    expect(
      rumdlDiagnostics,
      `unexpected diagnostics: ${rumdlDiagnostics.map(d => d.message).join('; ')}`
    ).to.be.empty;
  });

  test('should handle pyproject.toml without [tool.rumdl] section', async () => {
    const configPath = path.join(testDir, 'pyproject.toml');
    const pyprojectContent = `[build-system]
requires = ["setuptools>=42", "wheel"]
build-backend = "setuptools.build_meta"

[tool.black]
line-length = 88
`;

    fs.writeFileSync(configPath, pyprojectContent);

    const doc = await vscode.workspace.openTextDocument(configPath);

    // Wait a bit for diagnostics to be computed
    await new Promise(resolve => setTimeout(resolve, 500));

    const diagnostics = vscode.languages.getDiagnostics(doc.uri);

    // Should not produce any rumdl diagnostics for pyproject.toml without [tool.rumdl]
    const rumdlDiagnostics = diagnostics.filter(d => d.source === 'rumdl');
    expect(rumdlDiagnostics).to.be.empty;
  });

  // Note: Error detection tests are covered by ConfigValidator unit tests
  // Integration tests focus on verifying the extraction and conversion work correctly
});
