import type { AuditEvent } from '@/lib/audit';

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const KIND_TITLE: Partial<Record<AuditEvent['kind'], string>> = {
  'submission.received': 'submission.received',
  'submission.created': 'submission.created',
  'email.received': 'email.received',
  'extraction.started': 'extraction.started',
  'extraction.fieldExtracted': 'extraction.fieldExtracted',
  'extraction.completed': 'extraction.completed',
  'extraction.rerun': 'extraction.rerun',
  'enrichment.started': 'enrichment.started',
  'enrichment.sourceQueried': 'enrichment.sourceQueried',
  'enrichment.sourceReturned': 'enrichment.sourceReturned',
  'enrichment.completed': 'enrichment.completed',
  'enrichment.rerun': 'enrichment.rerun',
  'conflict.detected': 'conflict.detected',
  'conflict.resolved': 'conflict.resolved',
  'conflict.dismissed': 'conflict.dismissed',
  'gap.detected': 'gap.detected',
  'gap.resolved': 'gap.resolved',
  'gap.dismissed': 'gap.dismissed',
  'gap.requestSent': 'gap.requestSent',
  'field.corrected': 'field.corrected',
  'triage.started': 'triage.started',
  'triage.checkEvaluated': 'triage.checkEvaluated',
  'triage.completed': 'triage.completed',
  'triage.checkOverridden': 'triage.checkOverridden',
  'triage.passedToRating': 'triage.passedToRating',
  'rating.started': 'rating.started',
  'rating.cellComputed': 'rating.cellComputed',
  'rating.completed': 'rating.completed',
  'rating.rerun': 'rating.rerun',
  'slip.generated': 'slip.generated',
  'slip.regenerated': 'slip.regenerated',
  'email.drafted': 'email.drafted',
  'quote.sent': 'quote.sent',
  'quote.markedStale': 'quote.markedStale',
  'recommendation.started': 'recommendation.started',
  'recommendation.completed': 'recommendation.completed',
  'recommendation.actedUpon': 'recommendation.actedUpon',
  'submission.advancedToBindPending': 'submission.advancedToBindPending',
  'bind.ceremonyStarted': 'bind.ceremonyStarted',
  'bind.hashConfirmed': 'bind.hashConfirmed',
  'bind.hashFailed': 'bind.hashFailed',
  'bind.hashOverridden': 'bind.hashOverridden',
  'bind.committed': 'bind.committed',
  'bind.held': 'bind.held',
  'schedule.generated': 'schedule.generated',
  'schedule.sent': 'schedule.sent',
  'subjectivity.created': 'subjectivity.created',
  'subjectivity.tracked': 'subjectivity.tracked',
  'mta.requestReceived': 'mta.requestReceived',
  'mta.extracted': 'mta.extracted',
  'mta.gapFlagged': 'mta.gapFlagged',
  'mta.gapResolved': 'mta.gapResolved',
  'mta.deltaRated': 'mta.deltaRated',
  'mta.capacityRechecked': 'mta.capacityRechecked',
  'mta.scheduleGenerated': 'mta.scheduleGenerated',
  'mta.scheduleEdited': 'mta.scheduleEdited',
  'mta.hashConfirmed': 'mta.hashConfirmed',
  'mta.hashOverridden': 'mta.hashOverridden',
  'mta.committed': 'mta.committed',
  'mta.scheduleSent': 'mta.scheduleSent',
};

function summarise(e: AuditEvent): string {
  switch (e.kind) {
    case 'submission.created':
      return `${e.broker} · ${e.folio}`;
    case 'extraction.completed':
      return `${e.fieldCount} fields · avg conf ${(e.avgConfidence * 100).toFixed(0)}%`;
    case 'enrichment.completed':
      return `${e.sources.length} sources · ${e.conflictCount} conflict${e.conflictCount === 1 ? '' : 's'} · ${e.gapCount} gap${e.gapCount === 1 ? '' : 's'}`;
    case 'conflict.resolved':
      return `${e.fieldPath} · ${e.choice}`;
    case 'field.corrected':
      return `${e.fieldPath}${e.note ? ' · ' + e.note : ''}`;
    case 'triage.completed':
      return `verdict: ${e.verdict}`;
    case 'triage.checkOverridden':
      return `${e.check} · ${e.from} → ${e.to}`;
    case 'rating.completed':
      return `£${e.premium.toLocaleString()} · ${e.tier} ${e.version} · ${e.sha}`;
    case 'slip.generated':
      return `${e.slipRef} · £${e.premium.toLocaleString()} · ${e.sha}`;
    case 'quote.sent':
      return `to ${e.recipient}`;
    case 'recommendation.completed':
      return `${e.primary.toUpperCase()} · ${e.confidence}`;
    case 'recommendation.actedUpon':
      return `action: ${e.action}`;
    case 'bind.ceremonyStarted':
      return `started by ${e.startedBy}`;
    case 'bind.hashConfirmed':
      return `Hash ${hashLabelInline(e.hashId)} · ${e.artefactSha}`;
    case 'bind.hashFailed':
      return `Hash ${hashLabelInline(e.hashId)} · expected ${e.expectedSha}, got ${e.currentSha}`;
    case 'bind.hashOverridden':
      return `Hash ${hashLabelInline(e.hashId)} override · ${e.reason.slice(0, 64)}${e.reason.length > 64 ? '…' : ''}`;
    case 'bind.committed':
      return `${e.policyRef} issued · £${e.premium.toLocaleString('en-GB')} · ${e.hashes.length} hashes signed`;
    case 'schedule.generated':
      return `${e.policyRef} · ${e.recipient}`;
    case 'schedule.sent':
      return `${e.policyRef} → ${e.recipient}`;
    case 'subjectivity.created':
      return `${e.subjectivityType} · ${e.affectedSites.length} site${e.affectedSites.length === 1 ? '' : 's'}`;
    default:
      return '';
  }
}

function hashLabelInline(id: string): string {
  if (id === 'premium') return '1 · premium';
  if (id === 'subjectivities') return '2 · subjectivities';
  if (id === 'sanctions') return '3 · sanctions';
  if (id === 'capacity') return '4 · capacity';
  return id;
}

export function AuditEventRow({ event }: { event: AuditEvent }) {
  const time = TIME_FMT.format(new Date(event.at));
  const title = KIND_TITLE[event.kind] ?? event.kind;
  const subtitle = summarise(event);
  return (
    <li
      style={{
        padding: '8px 0',
        display: 'grid',
        gridTemplateColumns: '78px 1fr',
        gap: 14,
        alignItems: 'baseline',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          color: 'var(--color-ink-mute)',
          letterSpacing: '0.06em',
        }}
      >
        {time}
      </span>
      <div>
        <div
          className="mono"
          style={{
            fontSize: 11.5,
            color: 'var(--color-ink)',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--color-ink-mute)',
              marginTop: 2,
              lineHeight: 1.5,
              letterSpacing: '-0.005em',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </li>
  );
}
