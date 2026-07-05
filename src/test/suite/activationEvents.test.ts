import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_SUPPORTED_LANGUAGE_IDS, PROMPT_FILE_LANGUAGE_IDS } from '../../utils';

/**
 * Guards against drift between the language IDs rumdl attaches to in code and the
 * `onLanguage:*` activation events declared in package.json. If they diverge, the
 * extension can fail to activate for a language it claims to support (or declare
 * an activation event for a language it never handles).
 */
suite('Activation events match supported languages', () => {
  // Tests run from out/test/suite/, so the repo root is three levels up.
  const repoRoot = path.resolve(__dirname, '../../..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    activationEvents: string[];
  };

  const onLanguageIds = packageJson.activationEvents
    .filter(event => event.startsWith('onLanguage:'))
    .map(event => event.slice('onLanguage:'.length));

  test('onLanguage:* events exactly match ALL_SUPPORTED_LANGUAGE_IDS', () => {
    assert.deepStrictEqual(
      [...onLanguageIds].sort(),
      [...ALL_SUPPORTED_LANGUAGE_IDS].sort(),
      'package.json activationEvents onLanguage:* entries must match ALL_SUPPORTED_LANGUAGE_IDS'
    );
  });

  test('every PROMPT_FILE_LANGUAGE_IDS key has an onLanguage:* event', () => {
    for (const languageId of Object.keys(PROMPT_FILE_LANGUAGE_IDS)) {
      assert.ok(
        onLanguageIds.includes(languageId),
        `package.json is missing "onLanguage:${languageId}" for PROMPT_FILE_LANGUAGE_IDS.${languageId}`
      );
    }
  });
});
