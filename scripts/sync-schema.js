#!/usr/bin/env node

/**
 * Sync rumdl schema from rumdl binary to VSCode extension
 *
 * This script:
 * 1. Runs `rumdl schema print` to get the latest JSON schema
 * 2. Saves it to schemas/rumdl.schema.json
 * 3. Generates TypeScript types from the JSON schema
 * 4. Updates src/configSchema.ts with the generated types
 *
 * Usage:
 *   npm run sync-schema
 *   npm run sync-schema -- --rumdl-path /path/to/rumdl
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const rumdlPathIndex = args.indexOf('--rumdl-path');

// Determine rumdl binary path
let rumdlPath;
if (rumdlPathIndex !== -1 && args[rumdlPathIndex + 1]) {
  // Use provided path
  rumdlPath = args[rumdlPathIndex + 1];
} else {
  // Check if we're in CI (bundled tools available)
  const bundledToolsDir = path.join(__dirname, '..', 'bundled-tools');
  if (fs.existsSync(bundledToolsDir)) {
    // Use platform-appropriate bundled binary
    const platform = process.platform;
    const arch = process.arch;
    let binaryName;
    if (platform === 'win32') {
      binaryName = 'rumdl-x86_64-pc-windows-msvc.exe';
    } else if (platform === 'darwin') {
      binaryName = arch === 'arm64' ? 'rumdl-aarch64-apple-darwin' : 'rumdl-x86_64-apple-darwin';
    } else {
      binaryName = arch === 'arm64' ? 'rumdl-aarch64-unknown-linux-musl' : 'rumdl-x86_64-unknown-linux-musl';
    }
    rumdlPath = path.join(bundledToolsDir, binaryName);
  } else {
    // Fall back to local development path
    rumdlPath = '../rumdl/target/release/rumdl';
  }
}

const schemaOutputPath = path.join(__dirname, '..', 'schemas', 'rumdl.schema.json');
const configSchemaPath = path.join(__dirname, '..', 'src', 'configSchema.ts');

console.log('🔄 Syncing rumdl schema...');
console.log(`   Using rumdl binary: ${rumdlPath}`);

// Step 1: Generate schema from rumdl
console.log('\n📋 Step 1: Generating schema from rumdl...');
let schema;
try {
  const schemaJson = execSync(`${rumdlPath} schema print`, { encoding: 'utf-8' });
  schema = JSON.parse(schemaJson);
  console.log('   ✅ Schema generated successfully');
} catch (error) {
  console.error('   ❌ Failed to generate schema from rumdl:');
  console.error(`   ${error.message}`);
  process.exit(1);
}

// Step 2: Save schema to file
console.log('\n💾 Step 2: Saving schema to schemas/rumdl.schema.json...');
try {
  fs.writeFileSync(schemaOutputPath, JSON.stringify(schema, null, 2) + '\n');
  console.log(`   ✅ Schema saved to ${schemaOutputPath}`);
} catch (error) {
  console.error('   ❌ Failed to save schema:');
  console.error(`   ${error.message}`);
  process.exit(1);
}

// Step 3: Generate TypeScript types from schema
console.log('\n🔨 Step 3: Generating TypeScript types...');

// Extract GlobalConfig properties
// Support both old "definitions" and new "$defs" (JSON Schema 2020-12)
const defs = schema.$defs || schema.definitions;
if (!defs) {
  console.error('   ❌ Schema does not contain $defs or definitions');
  console.error(`   Schema keys: ${Object.keys(schema).join(', ')}`);
  process.exit(1);
}
const globalConfigDef = defs.GlobalConfig;
if (!globalConfigDef) {
  console.error('   ❌ Schema does not contain GlobalConfig definition');
  console.error(`   Available definitions: ${Object.keys(defs).join(', ')}`);
  process.exit(1);
}
const globalConfigProps = globalConfigDef.properties;

// Build GlobalConfig interface
let tsGlobalConfig = `export interface GlobalConfig {\n`;
for (const [key, prop] of Object.entries(globalConfigProps)) {
  const description = prop.description || '';
  const isOptional = !globalConfigDef.required || !globalConfigDef.required.includes(key);
  const optionalMarker = isOptional ? '?' : '';

  let tsType = 'any';
  if (prop.type === 'string') tsType = 'string';
  else if (prop.type === 'boolean') tsType = 'boolean';
  else if (prop.type === 'integer' || prop.type === 'number') tsType = 'number';
  else if (prop.type === 'array') tsType = prop.items?.type === 'string' ? 'string[]' : 'any[]';
  else if (prop.type && Array.isArray(prop.type) && prop.type.includes('null')) {
    // Handle nullable types (e.g., string | null)
    const nonNullType = prop.type.find(t => t !== 'null');
    if (nonNullType === 'string') tsType = 'string | null';
    else if (nonNullType === 'boolean') tsType = 'boolean | null';
    else if (nonNullType === 'number' || nonNullType === 'integer') tsType = 'number | null';
  }

  if (description) {
    tsGlobalConfig += `  /** ${description} */\n`;
  }
  tsGlobalConfig += `  '${key}'${optionalMarker}: ${tsType};\n`;
}
tsGlobalConfig += `}\n`;

// Extract rule schemas
let tsRuleSchemas = 'export const RULE_SCHEMAS: Record<string, any> = {\n';

// Scan schema properties for rule configurations (MD###)
for (const [key, value] of Object.entries(schema.properties || {})) {
  if (key.match(/^MD\d+$/)) {
    const ruleDef = defs[value.allOf?.[0]?.$ref?.split('/').pop()];
    if (ruleDef && ruleDef.properties) {
      const props = Object.keys(ruleDef.properties);
      tsRuleSchemas += `  '${key}': ${JSON.stringify(props)},\n`;
    }
  }
}
tsRuleSchemas += '};\n';

// Step 3b: Get rule names from rumdl
console.log('\n📋 Step 3b: Extracting rule names from rumdl...');
let ruleNames = [];
try {
  const rulesOutput = execSync(`${rumdlPath} rule`, { encoding: 'utf-8' });
  // Extract rule names (MD###) from the output
  const ruleMatches = rulesOutput.matchAll(/^\s+(MD\d+)/gm);
  ruleNames = Array.from(ruleMatches, m => m[1]);
  console.log(`   ✅ Found ${ruleNames.length} rules`);
} catch (error) {
  console.error('   ⚠️  Failed to extract rule names:');
  console.error(`   ${error.message}`);
  console.error('   Continuing with empty RULE_NAMES array');
}

// Build the full TypeScript file
const tsContent = `/**
 * Auto-generated from rumdl JSON schema
 * DO NOT EDIT MANUALLY - Run 'npm run sync-schema' to regenerate
 *
 * Generated: ${new Date().toISOString()}
 */

${tsGlobalConfig}

${tsRuleSchemas}

export const GLOBAL_PROPERTIES = ${JSON.stringify(Object.keys(globalConfigProps), null, 2)};

export const RULE_NAMES = ${JSON.stringify(ruleNames, null, 2)};
`;

// Step 4: Write TypeScript file
console.log('\n💾 Step 4: Updating src/configSchema.ts...');
try {
  fs.writeFileSync(configSchemaPath, tsContent);
  console.log(`   ✅ TypeScript types written to ${configSchemaPath}`);
} catch (error) {
  console.error('   ❌ Failed to write TypeScript file:');
  console.error(`   ${error.message}`);
  process.exit(1);
}

console.log('\n✨ Schema sync complete!\n');
console.log('Summary:');
console.log(`   - Schema version: ${schema.title || 'Config'}`);
console.log(`   - Global properties: ${Object.keys(globalConfigProps).length}`);
console.log(`   - Rule schemas: ${Object.keys(schema.properties || {}).filter(k => k.match(/^MD\d+$/)).length}`);
console.log('\nNext steps:');
console.log('   1. Review the changes to src/configSchema.ts');
console.log('   2. Run tests: npm test');
console.log('   3. Commit the updated files\n');
