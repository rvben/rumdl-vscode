import * as assert from 'assert';
import * as vscode from 'vscode';
import { matchGlobPattern } from 'vscode-languageclient/$test/common/utils/globPattern';

suite('Language client glob compatibility', () => {
  test('matches string patterns using the patched minimatch dependency', () => {
    assert.equal(matchGlobPattern('**/*.md', vscode.Uri.file('/workspace/docs/test.md')), true);
    assert.equal(matchGlobPattern('**/*.md', vscode.Uri.file('/workspace/docs/test.txt')), false);
  });

  test('respects the base URI of relative patterns', () => {
    const pattern = { baseUri: vscode.Uri.file('/workspace/docs').toString(), pattern: '*.md' };
    assert.equal(matchGlobPattern(pattern, vscode.Uri.file('/workspace/docs/test.md')), true);
    assert.equal(matchGlobPattern(pattern, vscode.Uri.file('/workspace/other/test.md')), false);
  });
});
