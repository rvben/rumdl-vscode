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
