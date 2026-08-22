import type { vsdiag } from 'vscode-languageclient/node';

/**
 * Preserve the most recently accepted diagnostics while an on-save document
 * is dirty.
 *
 * `vscode-languageclient` applies `diagnosticPullOptions` to editor change and
 * save events, but a server-initiated `workspace/diagnostic/refresh` bypasses
 * that schedule. rumdl legitimately uses that request when its cross-file
 * Markdown index changes. Holding the last report per dirty document prevents
 * such a global refresh from turning `onSave` back into `onType`, without
 * suppressing refreshes for other, clean documents.
 */
export class DiagnosticPullGate {
  private readonly reports = new Map<string, vsdiag.FullDocumentDiagnosticReport>();

  constructor(private readonly holdWhileDirty: boolean) {}

  /** Return the last accepted report when this pull must remain on-save-only. */
  public heldReport(
    uri: string,
    isDirty: boolean
  ): vsdiag.FullDocumentDiagnosticReport | undefined {
    if (!this.holdWhileDirty || !isDirty) {
      return undefined;
    }

    const report = this.reports.get(uri);
    return report ? this.clone(report) : undefined;
  }

  /** Remember a full report after it has passed through diagnostic middleware. */
  public remember(uri: string, report: vsdiag.FullDocumentDiagnosticReport): void {
    if (!this.holdWhileDirty) {
      return;
    }
    this.reports.set(uri, this.clone(report));
  }

  public forget(uri: string): void {
    this.reports.delete(uri);
  }

  public clear(): void {
    this.reports.clear();
  }

  private clone(report: vsdiag.FullDocumentDiagnosticReport): vsdiag.FullDocumentDiagnosticReport {
    return { ...report, items: [...report.items] };
  }
}
