import { expect } from '../helper';
import { DiagnosticLike, deduplicate, diagnosticKey, findDuplicates } from '../../diagnosticDedup';

/**
 * Tests for duplicate-diagnostic handling.
 *
 * These exercise the production functions both diagnostic delivery paths share,
 * so a change to either is covered here rather than in a re-implementation.
 */

function diag(
  line: number,
  message: string,
  code: unknown = 'MD013',
  character = 0
): DiagnosticLike {
  return {
    range: { start: { line, character }, end: { line, character: character + 5 } },
    message,
    code,
  };
}

suite('Diagnostic Deduplication Tests', () => {
  test('identical diagnostics share a key, differing ones do not', () => {
    expect(diagnosticKey(diag(3, 'Line too long'))).to.equal(
      diagnosticKey(diag(3, 'Line too long'))
    );

    // Each field that establishes identity must change the key.
    expect(diagnosticKey(diag(3, 'Line too long'))).to.not.equal(
      diagnosticKey(diag(4, 'Line too long'))
    );
    expect(diagnosticKey(diag(3, 'Line too long'))).to.not.equal(
      diagnosticKey(diag(3, 'Trailing spaces'))
    );
    expect(diagnosticKey(diag(3, 'Line too long', 'MD013'))).to.not.equal(
      diagnosticKey(diag(3, 'Line too long', 'MD009'))
    );
    expect(diagnosticKey(diag(3, 'Line too long', 'MD013', 0))).to.not.equal(
      diagnosticKey(diag(3, 'Line too long', 'MD013', 8))
    );
  });

  test('a code carrying a documentation link keys on its value', () => {
    // VS Code models a linked rule code as { value, target }; the target is a
    // URI object that would otherwise stringify to [object Object] for every code.
    const linked = diag(3, 'Line too long', { value: 'MD013', target: 'https://example.invalid' });
    const plain = diag(3, 'Line too long', 'MD013');

    expect(diagnosticKey(linked)).to.equal(diagnosticKey(plain));
    expect(diagnosticKey(linked)).to.not.contain('[object Object]');
  });

  test('duplicates are found and removed, keeping the first occurrence', () => {
    const first = diag(3, 'Line too long');
    const repeat = diag(3, 'Line too long');
    const other = diag(7, 'Trailing spaces', 'MD009');

    const duplicates = findDuplicates([first, repeat, other]);
    expect(duplicates).to.have.lengthOf(1);
    expect(duplicates[0]).to.equal(repeat);

    const unique = deduplicate([first, repeat, other]);
    expect(unique).to.have.lengthOf(2);
    expect(unique[0]).to.equal(first);
    expect(unique[1]).to.equal(other);
  });

  test('a list with no duplicates is preserved in order', () => {
    const input = [diag(1, 'a'), diag(2, 'b'), diag(3, 'c')];

    expect(findDuplicates(input)).to.have.lengthOf(0);
    expect(deduplicate(input).map(d => d.message)).to.deep.equal(['a', 'b', 'c']);
  });
});
