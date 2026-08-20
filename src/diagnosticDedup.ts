/**
 * Duplicate-diagnostic detection shared by the language client and the
 * "Check for duplicate diagnostics" command.
 *
 * The shapes involved differ: the client sees `vscode.Diagnostic` objects on the
 * push path and LSP protocol diagnostics on the pull path, and the command reads
 * whatever `vscode.languages.getDiagnostics` returns. They agree on the fields
 * that establish identity, so this module works against that common subset
 * rather than importing `vscode` (which also keeps it unit-testable).
 */

/** The subset of a diagnostic that establishes its identity. */
export interface DiagnosticLike {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  code?: unknown;
}

/**
 * Identity of a diagnostic: its range, message and rule code.
 *
 * Two diagnostics with the same key are the same finding reported twice, which
 * happens when another Markdown linter is active alongside rumdl.
 */
export function diagnosticKey(diagnostic: DiagnosticLike): string {
  const { start, end } = diagnostic.range;
  return `${start.line}:${start.character}-${end.line}:${end.character}:${diagnostic.message}:${codeToString(diagnostic.code)}`;
}

/**
 * A diagnostic code is a string, a number, or a `{ value, target }` pair when it
 * carries a documentation link. Only the value distinguishes one rule from another.
 */
function codeToString(code: unknown): string {
  if (code !== null && typeof code === 'object' && 'value' in code) {
    return String((code as { value: unknown }).value);
  }
  return String(code);
}

/** The diagnostics that repeat an earlier one, in the order they appear. */
export function findDuplicates<T extends DiagnosticLike>(diagnostics: readonly T[]): T[] {
  const seen = new Set<string>();
  const duplicates: T[] = [];

  for (const diagnostic of diagnostics) {
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) {
      duplicates.push(diagnostic);
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

/** The first occurrence of each distinct diagnostic, in the original order. */
export function deduplicate<T extends DiagnosticLike>(diagnostics: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const diagnostic of diagnostics) {
    const key = diagnosticKey(diagnostic);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(diagnostic);
    }
  }

  return unique;
}
