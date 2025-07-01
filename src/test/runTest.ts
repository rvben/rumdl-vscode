import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test runner script
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code, unzip it and run the integration test
    const testOptions: any = {
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions', // Only run your extension
      ],
    };

    // Add coverage support if nyc is running
    if (process.env.NYC_CWD) {
      testOptions.extensionTestsEnv = {
        ...process.env,
        COVERAGE: 'true',
      };
    }

    await runTests(testOptions);
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
