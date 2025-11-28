import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { GLOBAL_PROPERTIES } from '../../configSchema';

// Helper to find the correct rumdl binary for the current platform
function findRumdlBinary(): string | null {
  const bundledToolsDir = path.join(__dirname, '../../../bundled-tools');
  const platform = process.platform;
  const arch = process.arch;

  let binaryName: string;
  if (platform === 'win32') {
    binaryName = 'rumdl-x86_64-pc-windows-msvc.exe';
  } else if (platform === 'darwin') {
    binaryName = arch === 'arm64' ? 'rumdl-aarch64-apple-darwin' : 'rumdl-x86_64-apple-darwin';
  } else {
    binaryName =
      arch === 'arm64' ? 'rumdl-aarch64-unknown-linux-musl' : 'rumdl-x86_64-unknown-linux-musl';
  }

  const rumdlPath = path.join(bundledToolsDir, binaryName);
  return fs.existsSync(rumdlPath) ? rumdlPath : null;
}

suite('Schema Sync Test Suite', () => {
  test('Generated schema should have kebab-case properties', () => {
    const schemaPath = path.join(__dirname, '../../../schemas/rumdl.schema.json');
    assert.ok(fs.existsSync(schemaPath), 'Schema file should exist');

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    // Check that GlobalConfig properties exist
    // Note: JSON Schema draft 2020-12 uses $defs instead of definitions
    const globalConfigProps = (schema.$defs || schema.definitions)?.GlobalConfig?.properties;
    assert.ok(globalConfigProps, 'GlobalConfig properties should exist');

    // Verify kebab-case property names (rumdl uses kebab-case like Ruff)
    assert.ok(
      'respect-gitignore' in globalConfigProps,
      'Should have respect-gitignore (kebab-case)'
    );
    assert.ok('line-length' in globalConfigProps, 'Should have line-length (kebab-case)');
    assert.ok('output-format' in globalConfigProps, 'Should have output-format (kebab-case)');
    assert.ok('force-exclude' in globalConfigProps, 'Should have force-exclude (kebab-case)');

    // Verify common properties exist
    assert.ok('disable' in globalConfigProps, 'Should have disable');
    assert.ok('enable' in globalConfigProps, 'Should have enable');
    assert.ok('exclude' in globalConfigProps, 'Should have exclude');
    assert.ok('include' in globalConfigProps, 'Should have include');
  });

  test('TypeScript schema should match JSON schema property names', () => {
    const schemaPath = path.join(__dirname, '../../../schemas/rumdl.schema.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent);

    const globalConfigProps = (schema.$defs || schema.definitions)?.GlobalConfig?.properties;
    assert.ok(globalConfigProps, 'GlobalConfig properties should exist in schema');
    const jsonPropertyNames = Object.keys(globalConfigProps).sort();
    const tsPropertyNames = [...GLOBAL_PROPERTIES].sort();

    assert.deepStrictEqual(
      tsPropertyNames,
      jsonPropertyNames,
      'TypeScript GLOBAL_PROPERTIES should match JSON schema property names'
    );
  });

  test('Generated TypeScript config should have kebab-case properties', () => {
    // Verify that GLOBAL_PROPERTIES from the generated configSchema.ts has expected properties
    // rumdl uses kebab-case like Ruff
    assert.ok(
      GLOBAL_PROPERTIES.includes('respect-gitignore'),
      'GLOBAL_PROPERTIES should include respect-gitignore (kebab-case)'
    );
    assert.ok(
      GLOBAL_PROPERTIES.includes('line-length'),
      'GLOBAL_PROPERTIES should include line-length (kebab-case)'
    );
    assert.ok(
      GLOBAL_PROPERTIES.includes('output-format'),
      'GLOBAL_PROPERTIES should include output-format (kebab-case)'
    );
    assert.ok(
      GLOBAL_PROPERTIES.includes('force-exclude'),
      'GLOBAL_PROPERTIES should include force-exclude (kebab-case)'
    );

    // Verify common properties exist
    assert.ok(GLOBAL_PROPERTIES.includes('disable'), 'GLOBAL_PROPERTIES should include disable');
    assert.ok(GLOBAL_PROPERTIES.includes('enable'), 'GLOBAL_PROPERTIES should include enable');
    assert.ok(GLOBAL_PROPERTIES.includes('exclude'), 'GLOBAL_PROPERTIES should include exclude');
    assert.ok(GLOBAL_PROPERTIES.includes('include'), 'GLOBAL_PROPERTIES should include include');
  });

  test('JSON schema should be valid JSON', () => {
    const schemaPath = path.join(__dirname, '../../../schemas/rumdl.schema.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // This will throw if JSON is invalid
    assert.doesNotThrow(() => {
      JSON.parse(schemaContent);
    }, 'Schema file should be valid JSON');
  });

  test('Schema should match rumdl binary output', function () {
    // This test validates that the committed schema matches what `rumdl schema print` generates
    // Inspired by Ruff's schema validation approach
    this.timeout(10000); // Increase timeout for running rumdl binary

    const schemaPath = path.join(__dirname, '../../../schemas/rumdl.schema.json');
    const committedSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    // Try to find rumdl binary using platform-appropriate path
    const rumdlPath = findRumdlBinary();
    if (!rumdlPath) {
      console.warn(`⚠️  Skipping schema validation: no rumdl binary found for this platform`);
      this.skip();
      return;
    }

    let generatedSchemaJson: string;
    try {
      generatedSchemaJson = execSync(`${rumdlPath} schema print`, {
        encoding: 'utf-8',
        timeout: 5000,
      });
    } catch (error) {
      console.error('Failed to run rumdl schema print:', error);
      this.skip();
      return;
    }

    const generatedSchema = JSON.parse(generatedSchemaJson);

    // Compare GlobalConfig properties
    const committedProps = (committedSchema.$defs || committedSchema.definitions)?.GlobalConfig
      ?.properties;
    const generatedProps = (generatedSchema.$defs || generatedSchema.definitions)?.GlobalConfig
      ?.properties;

    assert.ok(committedProps, 'Committed schema should have GlobalConfig properties');
    assert.ok(generatedProps, 'Generated schema should have GlobalConfig properties');

    const committedKeys = Object.keys(committedProps).sort();
    const generatedKeys = Object.keys(generatedProps).sort();

    assert.deepStrictEqual(
      committedKeys,
      generatedKeys,
      `Schema property names should match.

Run 'npm run sync-schema' to regenerate the schema if this test fails.

Committed properties: ${committedKeys.join(', ')}
Generated properties: ${generatedKeys.join(', ')}`
    );

    // Verify all properties use kebab-case (no snake_case)
    for (const key of committedKeys) {
      assert.ok(!key.includes('_'), `Property "${key}" should use kebab-case, not snake_case`);
    }
  });
});
