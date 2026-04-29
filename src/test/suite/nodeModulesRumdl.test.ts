import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { expect } from '../helper';
import { BundledToolsManager } from '../../bundledTools';

/**
 * Tests for node_modules rumdl detection (getWorkspaceNodeModulesRumdlPath)
 * and the updated getBestRumdlPath resolution order.
 *
 * Uses real temporary directories (os.tmpdir) rather than mock fs, matching
 * the pattern established by getWorkspaceVenvRumdlPath tests.
 */

/**
 * Typed access to BundledToolsManager private statics for testing.
 *
 * Localizing the type assertion here keeps tests fully typed (autocomplete,
 * field validation) while preserving the production class's encapsulation.
 * If a private member is renamed, this declaration breaks first — making the
 * coupling visible rather than hidden behind `as any`.
 */
type BundledToolsManagerInternal = {
  getWorkspaceNodeModulesRumdlPath(): string | null;
  buildNodeModulesCandidates(
    workspaceRoot: string,
    platform: NodeJS.Platform,
    arch: string
  ): string[];
  readonly NPM_PLATFORM_MAP: Record<string, string>;
  readonly NPM_PLATFORM_FALLBACK_MAP: Record<string, string | undefined>;
};
const internal = BundledToolsManager as unknown as BundledToolsManagerInternal;
suite('NodeModules Rumdl Detection Tests', () => {
  let tmpDir: string;
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumdl-test-'));
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper to create a file and all required parent dirs
  function mkfile(filePath: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '#!/usr/bin/env node\n');
  }

  // Stub workspace to point to tmpDir
  function stubWorkspace(folders: string[]): void {
    sandbox.stub(vscode.workspace, 'workspaceFolders').get(() =>
      folders.map((f, i) => ({
        uri: { fsPath: f, scheme: 'file' },
        name: path.basename(f),
        index: i,
      }))
    );
    sandbox.stub(vscode.workspace, 'isTrusted').get(() => true);
  }

  /**
   * Native package path for the current platform.
   *
   * The @rumdl/cli-<platform> npm packages place the binary at the package
   * root, NOT under bin/ — see the rumdl repo's npm scope package layout
   * (each package.json declares `"files": ["rumdl"]`).
   */
  function nativePackagePath(workspaceRoot: string): string {
    const platform = process.platform;
    const arch = process.arch;

    let scopePkg: string;
    let binaryName: string;

    if (platform === 'win32' && arch === 'x64') {
      scopePkg = '@rumdl/cli-win32-x64';
      binaryName = 'rumdl.exe';
    } else if (platform === 'darwin' && arch === 'x64') {
      scopePkg = '@rumdl/cli-darwin-x64';
      binaryName = 'rumdl';
    } else if (platform === 'darwin' && arch === 'arm64') {
      scopePkg = '@rumdl/cli-darwin-arm64';
      binaryName = 'rumdl';
    } else if (platform === 'linux' && arch === 'x64') {
      scopePkg = '@rumdl/cli-linux-x64-musl';
      binaryName = 'rumdl';
    } else if (platform === 'linux' && arch === 'arm64') {
      scopePkg = '@rumdl/cli-linux-arm64-musl';
      binaryName = 'rumdl';
    } else {
      // Unsupported platform — return a path that won't exist so tests skip gracefully.
      scopePkg = '@rumdl/cli-unsupported';
      binaryName = 'rumdl';
    }

    return path.join(workspaceRoot, 'node_modules', scopePkg, binaryName);
  }

  /**
   * Unix .bin symlink path. Not used on Windows: the .cmd shim cannot be spawned
   * without `shell: true`, so the resolver omits it.
   */
  function dotBinPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, 'node_modules', '.bin', 'rumdl');
  }

  /** JS wrapper path. Skipped on Windows for the same reason as `.bin`. */
  function wrapperPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, 'node_modules', 'rumdl', 'bin', 'rumdl');
  }

  const isWindows = process.platform === 'win32';

  // -------------------------------------------------------------------------
  // a) Native binary is preferred when all three candidates exist
  // -------------------------------------------------------------------------
  test('native binary wins when all candidates are present', () => {
    stubWorkspace([tmpDir]);

    mkfile(nativePackagePath(tmpDir));
    mkfile(dotBinPath(tmpDir));
    mkfile(wrapperPath(tmpDir));

    // Access the private method via type assertion
    const result = internal.getWorkspaceNodeModulesRumdlPath();
    expect(result).to.equal(nativePackagePath(tmpDir));
  });

  // -------------------------------------------------------------------------
  // b) .bin/rumdl wins when native package is absent (Unix only — Windows omits this)
  // -------------------------------------------------------------------------
  (isWindows ? test.skip : test)('.bin fallback wins when native package is absent', () => {
    stubWorkspace([tmpDir]);

    // Do NOT create native package binary
    mkfile(dotBinPath(tmpDir));
    mkfile(wrapperPath(tmpDir));

    const result = internal.getWorkspaceNodeModulesRumdlPath();
    expect(result).to.equal(dotBinPath(tmpDir));
  });

  // -------------------------------------------------------------------------
  // c) node_modules/rumdl/bin/rumdl is the last-resort candidate (Unix only)
  // -------------------------------------------------------------------------
  (isWindows ? test.skip : test)(
    'wrapper binary is last-resort when only rumdl/bin/rumdl exists',
    () => {
      stubWorkspace([tmpDir]);

      mkfile(wrapperPath(tmpDir));

      const result = internal.getWorkspaceNodeModulesRumdlPath();
      expect(result).to.equal(wrapperPath(tmpDir));
    }
  );

  // -------------------------------------------------------------------------
  // c2) Windows omits the .bin shim and JS wrapper because LanguageClient
  //     spawns without `shell: true` and neither path is directly executable.
  // -------------------------------------------------------------------------
  (isWindows ? test : test.skip)(
    'Windows returns null when only the .bin shim or JS wrapper is present',
    () => {
      stubWorkspace([tmpDir]);

      mkfile(path.join(tmpDir, 'node_modules', '.bin', 'rumdl.cmd'));
      mkfile(wrapperPath(tmpDir));

      const result = internal.getWorkspaceNodeModulesRumdlPath();
      expect(result).to.be.null;
    }
  );

  // -------------------------------------------------------------------------
  // d) Returns null when no node_modules rumdl is present
  // -------------------------------------------------------------------------
  test('returns null when no node_modules rumdl exists', () => {
    stubWorkspace([tmpDir]);

    // No node_modules at all
    const result = internal.getWorkspaceNodeModulesRumdlPath();
    expect(result).to.be.null;
  });

  // -------------------------------------------------------------------------
  // e) Multi-workspace: first-folder match wins.
  //     Uses the native package path so the test exercises identical behavior
  //     on every platform.
  // -------------------------------------------------------------------------
  test('returns match from first workspace folder that contains a node_modules rumdl', () => {
    const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumdl-test2-'));
    try {
      stubWorkspace([tmpDir, secondDir]);

      // Only second folder has a node_modules rumdl.
      mkfile(nativePackagePath(secondDir));

      const result = internal.getWorkspaceNodeModulesRumdlPath();
      expect(result).to.equal(nativePackagePath(secondDir));
    } finally {
      fs.rmSync(secondDir, { recursive: true, force: true });
    }
  });

  test('first workspace folder wins when both folders contain a match', () => {
    const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumdl-test3-'));
    try {
      stubWorkspace([tmpDir, secondDir]);

      mkfile(nativePackagePath(tmpDir));
      mkfile(nativePackagePath(secondDir));

      const result = internal.getWorkspaceNodeModulesRumdlPath();
      expect(result).to.equal(nativePackagePath(tmpDir));
    } finally {
      fs.rmSync(secondDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // f) getBestRumdlPath resolution order
  //    configured > venv > node_modules > system PATH > bundled
  // -------------------------------------------------------------------------
  test('configured path always wins over node_modules', async () => {
    stubWorkspace([tmpDir]);
    mkfile(nativePackagePath(tmpDir));

    const configured = '/explicit/rumdl';
    const result = await BundledToolsManager.getBestRumdlPath(configured);
    expect(result).to.equal(configured);
  });

  test('node_modules is checked before system PATH and bundled binary', async () => {
    stubWorkspace([tmpDir]);
    mkfile(nativePackagePath(tmpDir));

    // With no configured path: venv check (none) → node_modules check (finds native binary)
    // → returns. System PATH and bundled binary are never reached.
    const result = await BundledToolsManager.getBestRumdlPath(undefined);

    expect(result).to.equal(nativePackagePath(tmpDir));
  });

  // -------------------------------------------------------------------------
  // g) Untrusted workspace ignores node_modules entirely
  // -------------------------------------------------------------------------
  test('untrusted workspace skips node_modules and returns bundled binary', async () => {
    sandbox.stub(vscode.workspace, 'isTrusted').get(() => false);
    sandbox
      .stub(vscode.workspace, 'workspaceFolders')
      .get(() => [{ uri: { fsPath: tmpDir, scheme: 'file' }, name: 'test', index: 0 }]);

    // Place a node_modules rumdl that the security guard must ignore.
    mkfile(nativePackagePath(tmpDir));

    // Stub bundled-binary lookup to a known path so we can assert exact equality
    // (avoids fragile substring matches on internal directory names).
    const fakeBundled = path.join(tmpDir, 'fake-bundled', 'rumdl');
    sandbox.stub(BundledToolsManager, 'getBundledRumdlPath').returns(fakeBundled);

    const result = await BundledToolsManager.getBestRumdlPath(undefined);

    expect(result).to.equal(fakeBundled);
  });

  test('untrusted workspace falls back to "rumdl" string when no bundled binary exists', async () => {
    sandbox.stub(vscode.workspace, 'isTrusted').get(() => false);
    sandbox
      .stub(vscode.workspace, 'workspaceFolders')
      .get(() => [{ uri: { fsPath: tmpDir, scheme: 'file' }, name: 'test', index: 0 }]);

    mkfile(nativePackagePath(tmpDir));

    // No bundled binary available — must NOT silently fall through to node_modules.
    sandbox.stub(BundledToolsManager, 'getBundledRumdlPath').returns(null);

    const result = await BundledToolsManager.getBestRumdlPath(undefined);

    expect(result).to.equal('rumdl');
  });

  // -------------------------------------------------------------------------
  // h) Cross-platform candidate-list builder.
  //    The pure builder function takes (workspaceRoot, platform, arch) so we
  //    can verify the per-platform priority list without mutating process.platform.
  // -------------------------------------------------------------------------
  suite('buildNodeModulesCandidates', () => {
    const root = '/ws';

    test('darwin-arm64 produces native package path at package root, plus Unix fallbacks', () => {
      const candidates = internal.buildNodeModulesCandidates(root, 'darwin', 'arm64');
      expect(candidates).to.deep.equal([
        path.join(root, 'node_modules', '@rumdl/cli-darwin-arm64', 'rumdl'),
        path.join(root, 'node_modules', '.bin', 'rumdl'),
        path.join(root, 'node_modules', 'rumdl', 'bin', 'rumdl'),
      ]);
    });

    test('linux-x64 includes musl primary AND GNU fallback at package root', () => {
      const candidates = internal.buildNodeModulesCandidates(root, 'linux', 'x64');
      expect(candidates).to.deep.equal([
        path.join(root, 'node_modules', '@rumdl/cli-linux-x64-musl', 'rumdl'),
        path.join(root, 'node_modules', '@rumdl/cli-linux-x64', 'rumdl'),
        path.join(root, 'node_modules', '.bin', 'rumdl'),
        path.join(root, 'node_modules', 'rumdl', 'bin', 'rumdl'),
      ]);
    });

    test('linux-arm64 includes musl primary AND GNU fallback', () => {
      const candidates = internal.buildNodeModulesCandidates(root, 'linux', 'arm64');
      expect(candidates).to.deep.equal([
        path.join(root, 'node_modules', '@rumdl/cli-linux-arm64-musl', 'rumdl'),
        path.join(root, 'node_modules', '@rumdl/cli-linux-arm64', 'rumdl'),
        path.join(root, 'node_modules', '.bin', 'rumdl'),
        path.join(root, 'node_modules', 'rumdl', 'bin', 'rumdl'),
      ]);
    });

    test('win32-x64 produces ONLY the native rumdl.exe — .bin shim and JS wrapper are omitted', () => {
      // Critical: LanguageClient spawns without `shell: true`, so neither the .cmd
      // shim nor the JS wrapper would actually launch. Returning them would produce
      // a broken auto-detect on Windows, so the resolver must drop them.
      const candidates = internal.buildNodeModulesCandidates(root, 'win32', 'x64');
      expect(candidates).to.deep.equal([
        path.join(root, 'node_modules', '@rumdl/cli-win32-x64', 'rumdl.exe'),
      ]);
    });

    test('unsupported platform/arch returns Unix fallbacks only (no native package)', () => {
      // For example freebsd-x64 — we ship no @rumdl/cli-freebsd-x64 package, but the
      // JS wrapper still works on Unix-like systems. Return what we can.
      const candidates = internal.buildNodeModulesCandidates(root, 'freebsd', 'x64');
      expect(candidates).to.deep.equal([
        path.join(root, 'node_modules', '.bin', 'rumdl'),
        path.join(root, 'node_modules', 'rumdl', 'bin', 'rumdl'),
      ]);
    });

    test('scope-package candidates probe at package root, never under bin/ subdir', () => {
      // Regression guard: the @rumdl/cli-* packages place the binary at the package
      // root (`"files": ["rumdl"]` in their package.json). An earlier draft probed
      // node_modules/<scope>/bin/<binary>, which never matches a real install.
      const platforms: NodeJS.Platform[] = ['darwin', 'linux', 'win32'];
      const archs = ['x64', 'arm64'];
      for (const platform of platforms) {
        for (const arch of archs) {
          for (const candidate of internal.buildNodeModulesCandidates(root, platform, arch)) {
            // Inspect path segments instead of regex (cross-platform path separators).
            const segments = candidate.split(path.sep);
            const scopeIdx = segments.findIndex(s => s.startsWith('cli-'));
            if (scopeIdx >= 0) {
              const segmentAfterScope = segments[scopeIdx + 1];
              expect(
                segmentAfterScope,
                `${candidate}: segment after @rumdl/cli-* must be the binary, not "bin"`
              ).to.not.equal('bin');
            }
          }
        }
      }
    });
  });

  test('npm platform mapping uses musl-first for Linux with GNU fallback', () => {
    const { NPM_PLATFORM_MAP: npmMap, NPM_PLATFORM_FALLBACK_MAP: npmFallbackMap } = internal;

    expect(npmMap['win32-x64']).to.equal('@rumdl/cli-win32-x64');
    expect(npmMap['darwin-x64']).to.equal('@rumdl/cli-darwin-x64');
    expect(npmMap['darwin-arm64']).to.equal('@rumdl/cli-darwin-arm64');
    expect(npmMap['linux-x64']).to.equal('@rumdl/cli-linux-x64-musl');
    expect(npmMap['linux-arm64']).to.equal('@rumdl/cli-linux-arm64-musl');

    expect(npmFallbackMap['linux-x64']).to.equal('@rumdl/cli-linux-x64');
    expect(npmFallbackMap['linux-arm64']).to.equal('@rumdl/cli-linux-arm64');

    expect(npmFallbackMap['darwin-x64']).to.be.undefined;
    expect(npmFallbackMap['darwin-arm64']).to.be.undefined;
    expect(npmFallbackMap['win32-x64']).to.be.undefined;
  });

  // -------------------------------------------------------------------------
  // Returns null when no workspace folders are open
  // -------------------------------------------------------------------------
  test('returns null when workspaceFolders is empty', () => {
    sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => []);

    const result = internal.getWorkspaceNodeModulesRumdlPath();
    expect(result).to.be.null;
  });

  test('returns null when workspaceFolders is undefined', () => {
    sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => undefined);

    const result = internal.getWorkspaceNodeModulesRumdlPath();
    expect(result).to.be.null;
  });
});
