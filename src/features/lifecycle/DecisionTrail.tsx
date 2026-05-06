import { useRanBerri } from '@/store';
import type { AuditEvent } from '@/lib/audit';
import { ALL_ARTIFACTS, type ArtifactKey } from '@/lib/deps';

const KIND_LABEL: Record<AuditEvent['kind'], string> = {
  'submission.received': 'Submission received',
  'submission.created': 'Submission created',
  'email.received': 'Email received',
  'extraction.started': 'Extraction started',
  'extraction.fieldExtracted': 'Field extracted',
  'extraction.completed': 'Extraction completed',
  'extraction.rerun': 'Extraction rerun',
  'enrichment.started': 'Enrichment started',
  'enrichment.sourceQueried': 'Source queried',
  'enrichment.sourceReturned': 'Source returned',
  'enrichment.completed': 'Enrichment completed',
  'enrichment.rerun': 'Enrichment rerun',
  'conflict.detected': 'Conflict raised',
  'conflict.resolved': 'Conflict resolved',
  'conflict.flagged': 'Conflict flagged',
  'gap.flagged': 'Gap flagged',
  'gap.detected': 'Gap surfaced',
  'gap.resolved': 'Gap resolved',
  'gap.requestSent': 'Broker request queued',
  'field.corrected': 'Field corrected',
  'rating.computed': 'Rating computed',
  'quote.issued': 'Quote issued',
  'recommendation.generated': 'Recommendation generated',
  'decision.recorded': 'Decision recorded',
  'artifact.computed': 'Artifact computed',
  'artifact.stale': 'Artifact marked stale',
};

const ARTIFACT_LABEL: Record<ArtifactKey, string> = {
  enrichment: 'Enrichment',
  conflicts: 'Conflicts',
  rating: 'Rating',
  quote: 'Quote',
  recommendation: 'Recommendation',
};

function formatActor(actor: AuditEvent['actor']): string {
  if (actor.kind === 'system') return actor.modelVersion ?? 'system';
  if (actor.kind === 'underwriter') return actor.id;
  return actor.id;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function dotTone(kind: AuditEvent['kind']): string {
  if (
    kind === 'gap.flagged' ||
    kind === 'gap.detected' ||
    kind === 'conflict.flagged' ||
    kind === 'conflict.detected' ||
    kind === 'artifact.stale'
  )
    return 'var(--color-warn)';
  if (
    kind === 'field.corrected' ||
    kind === 'conflict.resolved' ||
    kind === 'gap.resolved'
  )
    return 'var(--color-accent)';
  if (
    kind === 'extraction.completed' ||
    kind === 'enrichment.completed' ||
    kind === 'rating.computed' ||
    kind === 'quote.issued' ||
    kind === 'artifact.computed'
  )
    return 'var(--color-success)';
  return 'var(--color-ink)';
}

/**
 * The trail aggregates duplicates that fire in the same second
 * (e.g. 12 extraction.fieldExtracted events). Field-level events get
 * collapsed into a single row that shows the count + average
 * confidence; the underlying log is untouched.
 */
type EventEntry = {
  kind: 'event';
  event: AuditEvent;
  count?: number;
  subtitle?: string;
};

function aggregate(log: AuditEvent[]): EventEntry[] {
  // Hide noise-y replay-only events. The cinematic emits one query+return
  // per source, but the user-facing rail summarises the whole pass via
  // enrichment.completed.
  const filtered = log.filter(
    (e) =>
      e.kind !== 'extraction.fieldExtracted' &&
      e.kind !== 'submission.created' &&
      e.kind !== 'enrichment.sourceQueried' &&
      e.kind !== 'enrichment.sourceReturned',
  );
  return filtered.map((event) => {
    if (event.kind === 'extraction.completed') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.fieldCount} fields · avg conf ${(event.avgConfidence * 100).toFixed(0)}%`,
      };
    }
    if (event.kind === 'enrichment.completed') {
      const conflicts = event.conflictCount;
      const gaps = event.gapCount;
      const confirmed = event.sources.length - conflicts;
      return {
        kind: 'event',
        event,
        subtitle: `${event.sources.length} sources · ${conflicts} conflict${conflicts === 1 ? '' : 's'} · ${gaps} gap${gaps === 1 ? '' : 's'} · ${confirmed} confirmed`,
      };
    }
    if (event.kind === 'gap.flagged' || event.kind === 'gap.detected') {
      return { kind: 'event', event, subtitle: event.description };
    }
    if (event.kind === 'gap.resolved') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.fieldPath} · ${event.choice}`,
      };
    }
    if (event.kind === 'gap.requestSent') {
      return {
        kind: 'event',
        event,
        subtitle: `to ${event.recipient}`,
      };
    }
    if (event.kind === 'conflict.detected') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.fieldPath} · ${event.externalSource}`,
      };
    }
    if (event.kind === 'conflict.resolved') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.fieldPath} · ${event.choice}`,
      };
    }
    if (event.kind === 'field.corrected') {
      const subtitle = event.note
        ? `${event.fieldPath} · ${event.note}`
        : event.fieldPath;
      return { kind: 'event', event, subtitle };
    }
    if (event.kind === 'artifact.stale') {
      return { kind: 'event', event, subtitle: event.artifact };
    }
    if (event.kind === 'artifact.computed') {
      return { kind: 'event', event, subtitle: event.artifact };
    }
    if (event.kind === 'extraction.rerun') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.preservedCorrections} corrections preserved`,
      };
    }
    if (event.kind === 'enrichment.rerun') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.preservedResolutions} resolutions preserved`,
      };
    }
    return { kind: 'event', event };
  });
}

type Props = {
  side?: 'left' | 'right';
  width?: number;
};

export function DecisionTrail({ side = 'left', width = 296 }: Props = {}) {
  const log = useRanBerri((s) => s.auditLog);
  const artifacts = useRanBerri((s) => s.artifacts);
  const submission = useRanBerri((s) => s.submission);
  const borderClass = side === 'right' ? 'hairline-l' : 'hairline-r';

  const entries = aggregate(log);
  const pendingArtifacts = submission
    ? ALL_ARTIFACTS.filter((k) => artifacts[k].computedAt === null)
    : [];

  return (
    <aside
      className={borderClass}
      style={{
        width,
        flex: `0 0 ${width}px`,
        background: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        className="hairline-b flex items-center justify-between"
        style={{ padding: '12px 16px', height: 44, flex: '0 0 auto' }}
      >
        <div className="eyebrow">decision trail</div>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.06em',
          }}
        >
          {entries.length} events
        </span>
      </div>

      <div style={{ padding: '12px 16px 8px', flex: '0 0 auto' }}>
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 11.5,
            color: 'var(--color-ink-mute)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          every meaningful state transition, in order.
        </p>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        {entries.length === 0 && pendingArtifacts.length === 0 ? (
          <EmptyTrail />
        ) : (
          <ol
            className="relative"
            style={{ listStyle: 'none', padding: 0, margin: 0 }}
          >
            <div
              className="absolute"
              style={{
                left: 6,
                top: 4,
                bottom: 4,
                width: 0.5,
                background: 'var(--color-rule)',
              }}
              aria-hidden
            />
            {entries.map((entry, i) => (
              <EventRow key={i} entry={entry} />
            ))}
            {pendingArtifacts.map((k) => (
              <PendingRow key={`p-${k}`} artifact={k} />
            ))}
          </ol>
        )}
      </div>

      <div
        className="hairline-t"
        style={{
          padding: '10px 16px',
          flex: '0 0 auto',
          background: 'var(--color-bg)',
        }}
      >
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 11.5,
            color: 'var(--color-ink-faint)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          audit trail as the spine
        </p>
      </div>
    </aside>
  );
}

function EventRow({ entry }: { entry: EventEntry }) {
  const evt = entry.event;
  const tone = dotTone(evt.kind);
  return (
    <li className="relative" style={{ paddingLeft: 22, paddingBottom: 14 }}>
      <span
        className="absolute"
        style={{
          left: 2,
          top: 5,
          width: 9,
          height: 9,
          borderRadius: 999,
          background: tone,
          border: `0.5px solid ${tone}`,
        }}
        aria-hidden
      />
      <div
        className="flex items-baseline justify-between"
        style={{ fontSize: 12, color: 'var(--color-ink)' }}
      >
        <span style={{ fontWeight: 500 }}>{KIND_LABEL[evt.kind]}</span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.04em',
          }}
        >
          {formatTime(evt.at)}
        </span>
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-mute)',
          marginTop: 2,
        }}
      >
        {entry.subtitle ?? formatActor(evt.actor)}
      </div>
    </li>
  );
}

function PendingRow({ artifact }: { artifact: ArtifactKey }) {
  return (
    <li
      className="relative"
      style={{ paddingLeft: 22, paddingBottom: 12, opacity: 0.7 }}
    >
      <span
        className="absolute"
        style={{
          left: 2,
          top: 5,
          width: 9,
          height: 9,
          borderRadius: 999,
          background: 'var(--color-surface)',
          border: '0.5px solid var(--color-rule-mid)',
        }}
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span
          style={{
            fontSize: 12,
            color: 'var(--color-ink-mute)',
          }}
        >
          {ARTIFACT_LABEL[artifact]}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.04em',
          }}
        >
          pending
        </span>
      </div>
    </li>
  );
}

function EmptyTrail() {
  return (
    <div
      className="hairline"
      style={{
        marginTop: 4,
        padding: '14px 14px',
        borderRadius: 'var(--radius-card)',
        borderStyle: 'dashed',
        background: 'var(--color-bg)',
      }}
    >
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          lineHeight: 1.5,
        }}
      >
        Awaiting first event. The trail begins when a submission is received.
      </div>
    </div>
  );
}
