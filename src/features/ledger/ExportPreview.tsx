import { Download, Send, Check } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useLedger } from '@/store/ledger';
import { useConfig } from '@/config';

const FMT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Module 15 — preview pane after report generation. Truncates the
 * body to the first ~24 lines for legibility; the actual download
 * carries the full content.
 */
export function ExportPreview() {
  const report = useLedger((s) => s.generatedReport);
  const exportSent = useLedger((s) => s.exportSent);
  const setExportSent = useLedger((s) => s.setExportSent);
  const closeExport = useLedger((s) => s.closeExport);
  const exportDraft = useLedger((s) => s.exportDraft);
  const appendAuditEvent = useRanBerri((s) => s.appendAuditEvent);
  const config = useConfig();

  if (!report) return null;

  const previewLines = report.body.split('\n').slice(0, 28);
  const truncated = report.body.split('\n').length > 28;

  function onDownload() {
    if (typeof document === 'undefined' || !report) return;
    const blob = new Blob([report.body], {
      type: report.format === 'csv' ? 'text/csv' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = report.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onSendToCapacity() {
    if (!report) return;
    const recipientEmail = config.metadata.capacityProvider.contactEmail;
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'ledger.exportSentToCapacity',
      sentBy: 'nm',
      recipientEmail,
      format: report.format,
      chainHash: report.chainHash,
      actionCount: report.actionCount,
    });
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'ledger.exported',
      exportedBy: 'nm',
      format: report.format,
      period: { from: report.period.fromISO, to: report.period.toISO },
      classes: report.classes.map(String),
      recipient: 'capacity-provider',
      actionCount: report.actionCount,
      chainHash: report.chainHash,
    });
    setExportSent({ recipient: recipientEmail, chainHash: report.chainHash });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        className="hairline-b"
        style={{ paddingBottom: 10, marginBottom: 4 }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
            marginBottom: 2,
          }}
        >
          report ready
        </div>
        <div
          className="serif"
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: 'var(--color-ink)',
            letterSpacing: '-0.012em',
          }}
        >
          {report.filename}
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            marginTop: 4,
            letterSpacing: '-0.005em',
          }}
        >
          {report.actionCount} actions ·{' '}
          {FMT_DATE.format(new Date(report.period.fromISO))} →{' '}
          {FMT_DATE.format(new Date(report.period.toISO))} ·{' '}
          {report.recallCount} recalled · {report.atRiskCount} at-risk
        </div>
      </div>
      <pre
        className="mono"
        style={{
          background: 'var(--color-bg)',
          border: '0.5px solid var(--color-rule-mid)',
          borderRadius: 'var(--radius-button)',
          padding: '10px 12px',
          fontSize: 10.5,
          color: 'var(--color-ink-soft)',
          letterSpacing: '0.02em',
          margin: 0,
          maxHeight: 240,
          overflow: 'auto',
          whiteSpace: 'pre',
          lineHeight: 1.45,
        }}
      >
        {previewLines.join('\n')}
        {truncated && (
          <>
            {'\n'}
            <span style={{ color: 'var(--color-ink-faint)' }}>
              … ({report.body.split('\n').length - 28} more lines)
            </span>
          </>
        )}
      </pre>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.06em',
          color: 'var(--color-ink-mute)',
        }}
      >
        chain hash · {report.chainHash}
      </div>

      {exportSent ? (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--radius-button)',
            background: 'var(--color-success-bg)',
            border: '0.5px solid var(--color-success)',
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <Check
            size={13}
            strokeWidth={1.75}
            style={{ color: 'var(--color-success)' }}
          />
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-success)',
              letterSpacing: '-0.005em',
            }}
          >
            Report queued for delivery to {exportSent.recipient}
          </span>
        </div>
      ) : null}

      <footer
        className="hairline-t flex items-center justify-end"
        style={{ paddingTop: 12, gap: 8 }}
      >
        <button
          type="button"
          onClick={closeExport}
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            padding: '4px 12px',
            borderRadius: 'var(--radius-button)',
            border: '0.5px solid var(--color-rule-mid)',
            background: 'transparent',
            color: 'var(--color-ink-mute)',
            cursor: 'pointer',
            letterSpacing: '-0.005em',
          }}
        >
          Close
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="serif inline-flex items-center gap-1"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            padding: '4px 12px',
            borderRadius: 'var(--radius-button)',
            border: '0.5px solid var(--color-rule-mid)',
            background: 'transparent',
            color: 'var(--color-ink-mute)',
            cursor: 'pointer',
            letterSpacing: '-0.005em',
          }}
        >
          <Download size={11} strokeWidth={1.5} />
          Download
        </button>
        {exportDraft.recipient === 'capacity-provider' && !exportSent && (
          <button
            type="button"
            onClick={onSendToCapacity}
            className="serif inline-flex items-center gap-1"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '4px 12px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-accent)',
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            <Send size={11} strokeWidth={1.5} />
            Send to capacity provider
          </button>
        )}
      </footer>
    </div>
  );
}
