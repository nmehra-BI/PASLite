import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useRanBerri } from '@/store';
import {
  daysUntilCritical,
  subjectivityTypeLabel,
} from '@/lib/fixtures/subjectivities';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Sub-inspector for a subjectivity record. Opens from
 * SubjectivitiesPanel; shows the source warranty text, affected
 * entities, audit chain reference (createdAt event timestamp).
 */
export function SubjectivityInspector() {
  const inspectingId = useRanBerri((s) => s.ui.inspectingSubjectivityId);
  const setInspecting = useRanBerri((s) => s.setInspectingSubjectivity);
  const subjectivities = useRanBerri((s) => s.postBind.subjectivities);
  const auditLog = useRanBerri((s) => s.auditLog);

  if (!inspectingId) return null;
  const sub = subjectivities.find((s) => s.id === inspectingId);
  if (!sub) return null;

  const createdEvent = auditLog.find(
    (e) => e.kind === 'subjectivity.created' && e.subjectivityId === sub.id,
  );
  const days = daysUntilCritical(sub.criticalDate);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setInspecting(null)}
      role="dialog"
      aria-label={`Subjectivity ${sub.id}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.18)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
      }}
    >
      <motion.aside
        initial={{ x: 16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="hairline-l"
        style={{
          width: 480,
          maxWidth: '90vw',
          background: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          className="hairline-b flex items-center justify-between"
          style={{ padding: '14px 22px', flex: '0 0 auto' }}
        >
          <div>
            <div className="eyebrow">subjectivity · {sub.id}</div>
            <div
              className="serif"
              style={{
                fontSize: 16,
                fontWeight: 500,
                marginTop: 2,
                color: 'var(--color-ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {subjectivityTypeLabel(sub.subjectivityType)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInspecting(null)}
            aria-label="Close"
            style={{ padding: 6, color: 'var(--color-ink-mute)' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
          <Section label="warranty text">
            <p
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 13.5,
                lineHeight: 1.6,
                color: 'var(--color-ink-soft)',
                margin: 0,
              }}
            >
              {sub.description}
            </p>
          </Section>

          {sub.criticalDate && (
            <Section label="critical date">
              <div style={{ fontSize: 14, color: 'var(--color-ink)' }}>
                {SHORT_DATE_FMT.format(new Date(sub.criticalDate))}
                {days !== null && (
                  <span
                    className="serif"
                    style={{
                      fontStyle: 'italic',
                      fontSize: 12.5,
                      color: 'var(--color-ink-mute)',
                      marginLeft: 8,
                    }}
                  >
                    · {days} day{days === 1 ? '' : 's'} from now
                  </span>
                )}
              </div>
              {sub.actionRequired && (
                <div
                  className="serif"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 12.5,
                    color: 'var(--color-warn)',
                    marginTop: 6,
                    letterSpacing: '-0.005em',
                  }}
                >
                  → {sub.actionRequired}
                </div>
              )}
            </Section>
          )}

          <Section label="affected entities">
            {sub.affectedSites.length > 0 ? (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 13,
                  color: 'var(--color-ink)',
                  lineHeight: 1.6,
                }}
              >
                {sub.affectedSites.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <span
                className="serif"
                style={{ fontStyle: 'italic', color: 'var(--color-ink-faint)' }}
              >
                None.
              </span>
            )}
          </Section>

          <Section label="status">
            <div
              className="flex items-center gap-2"
              style={{ fontSize: 13, color: 'var(--color-ink)' }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background:
                    sub.status === 'active'
                      ? 'var(--color-success)'
                      : sub.status === 'breached'
                        ? 'var(--color-danger)'
                        : 'var(--color-ink-faint)',
                }}
                aria-hidden
              />
              {sub.status} · {sub.autoMonitor ? 'auto-monitored' : 'disclosure-based'}
            </div>
          </Section>

          <Section label="audit chain">
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                color: 'var(--color-ink-mute)',
                letterSpacing: '0.04em',
                lineHeight: 1.7,
              }}
            >
              <div>created: {DATE_FMT.format(new Date(sub.createdAt))}</div>
              <div>
                event id: {createdEvent ? createdEvent.id : '—'}
              </div>
              <div>
                actor:{' '}
                {createdEvent
                  ? createdEvent.actor.kind === 'system'
                    ? 'system'
                    : createdEvent.actor.kind === 'underwriter'
                      ? createdEvent.actor.id
                      : createdEvent.actor.id
                  : '—'}
              </div>
            </div>
          </Section>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </section>
  );
}
