import { expect } from '../helper';
import { DiagnosticPullGate } from '../../diagnosticPullGate';
import type { vsdiag } from 'vscode-languageclient/node';
import * as vscode from 'vscode';

function report(message: string): vsdiag.FullDocumentDiagnosticReport {
  return {
    kind: 'full' as vsdiag.DocumentDiagnosticReportKind.full,
    items: [new vscode.Diagnostic(new vscode.Range(1, 0, 1, 3), message)],
  };
}

suite('Diagnostic Pull Gate Tests', () => {
  const uri = 'file:///workspace/linked.md';

  test('allows the first pull for a dirty document when no report is cached', () => {
    const gate = new DiagnosticPullGate(true);

    expect(gate.heldReport(uri, true)).to.be.undefined;
  });

  test('holds the last accepted report for a dirty on-save document', () => {
    const gate = new DiagnosticPullGate(true);
    gate.remember(uri, report('saved warning'));

    expect(gate.heldReport(uri, true)?.items[0].message).to.equal('saved warning');
  });

  test('allows refreshes for clean documents', () => {
    const gate = new DiagnosticPullGate(true);
    gate.remember(uri, report('saved warning'));

    expect(gate.heldReport(uri, false)).to.be.undefined;
  });

  test('allows refreshes while running on type', () => {
    const gate = new DiagnosticPullGate(false);
    gate.remember(uri, report('previous warning'));

    expect(gate.heldReport(uri, true)).to.be.undefined;
  });

  test('returns defensive copies of cached reports', () => {
    const gate = new DiagnosticPullGate(true);
    gate.remember(uri, report('saved warning'));

    const first = gate.heldReport(uri, true)!;
    first.items.length = 0;

    expect(gate.heldReport(uri, true)?.items).to.have.lengthOf(1);
  });

  test('forgets reports when documents close and when the gate clears', () => {
    const gate = new DiagnosticPullGate(true);
    const otherUri = 'file:///workspace/other.md';
    gate.remember(uri, report('one'));
    gate.remember(otherUri, report('two'));

    gate.forget(uri);
    expect(gate.heldReport(uri, true)).to.be.undefined;
    expect(gate.heldReport(otherUri, true)).to.exist;

    gate.clear();
    expect(gate.heldReport(otherUri, true)).to.be.undefined;
  });
});
