import { useRanBerri } from '@/store';
import type { AuditEvent } from '@/lib/audit';

const KIND_LABEL: Record<AuditEvent['kind'], string> = {
  'submission.received': 'Submission received',
  'extraction.started': 'Extraction started',
  'extraction.completed': 'Extraction completed',
  'enrichment.completed': 'Enrichment completed',
  'conflict.flagged': 'Conflict flagged',
  'field.corrected': 'Field corrected',
  'rating.computed': 'Rating computed',
  'quote.issued': 'Quote issued',
  'recommendation.generated': 'Recommendation generated',
  'decision.recorded': 'Decision recorded',
  'artifact.stale': 'Artifact marked stale',
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
  return `${hh}:${mm}`;
}

type Props = {
  /** Position in the workstation: left rail (default) or right rail. */
  side?: 'left' | 'right';
  /** Width of the rail. */
  width?: number;
};

export function DecisionTrail({ side = 'left', width = 296 }: Props = {}) {
  const log = useRanBerri((s) => s.auditLog);
  const borderClass = side === 'right' ? 'hairline-l' : 'hairline-r';

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
          {log.length} events
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
        {log.length === 0 ? (
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
            {log.map((evt) => (
              <li
                key={evt.id}
                className="relative"
                style={{ paddingLeft: 22, paddingBottom: 14 }}
              >
                <span
                  className="absolute"
                  style={{
                    left: 3,
                    top: 6,
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: 'var(--color-surface)',
                    border: '0.5px solid var(--color-rule-mid)',
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
                  {formatActor(evt.actor)}
                </div>
              </li>
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
