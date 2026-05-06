import { useRanBerri } from '@/store';
import {
  daysUntilCritical,
  subjectivityTypeLabel,
} from '@/lib/fixtures/subjectivities';
import { deriveCursorView } from '@/lib/lifecycle/cursorView';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Active subjectivities tracked from bind through the policy term.
 * Each row is clickable to open the SubjectivityInspector with full
 * provenance.
 */
export function SubjectivitiesPanel() {
  const allSubjectivities = useRanBerri((s) => s.postBind.subjectivities);
  const setInspecting = useRanBerri((s) => s.setInspectingSubjectivity);
  const bind = useRanBerri((s) => s.bind);
  const cursor = useRanBerri((s) => s.lifecycle.cursor);
  const now = useRanBerri((s) => s.lifecycle.now);
  const policy = useRanBerri((s) => s.policy);

  if (bind.phase !== 'committed') return null;

  // Filter the subjectivities to those existing at-or-before the
  // cursor's effective time. In the historical 'bind-v1' view this
  // hides MTA-created records; in the live view it's a no-op.
  const view = deriveCursorView({
    cursor,
    now,
    baseBindAt: policy.baseBindAt,
    versionCount: policy.versions.length,
    firstMtaSignedAt: policy.versions[0]?.signedAt ?? null,
  });
  const subjectivities =
    view.effectiveAt !== null
      ? allSubjectivities.filter((s) => s.createdAt < view.effectiveAt!)
      : allSubjectivities;

  if (subjectivities.length === 0) return null;

  return (
    <section
      className="hairline-t"
      style={{
        padding: '20px 28px 24px',
      }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">subjectivities · active</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13.5,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          tracked from bind through policy term
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {subjectivities.map((s, i) => {
          const days = daysUntilCritical(s.criticalDate);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setInspecting(s.id)}
              className="hairline"
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-card)',
                background: 'var(--color-surface)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 120ms cubic-bezier(0.4,0,0.2,1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-sunken)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-surface)';
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-faint)',
                }}
              >
                Subjectivity {i + 1} · {subjectivityTypeLabel(s.subjectivityType)}
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 14,
                  color: 'var(--color-ink)',
                  letterSpacing: '-0.005em',
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                {s.description}
              </div>
              {s.criticalDate && (
                <div
                  className="serif"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 12.5,
                    color: 'var(--color-ink-mute)',
                    marginTop: 4,
                  }}
                >
                  Critical date: {DATE_FMT.format(new Date(s.criticalDate))}
                  {days !== null && ` · ${days} day${days === 1 ? '' : 's'}`}
                </div>
              )}
              {s.affectedSites.length > 0 && (
                <div
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    color: 'var(--color-ink-mute)',
                    marginTop: 4,
                    letterSpacing: '0.04em',
                  }}
                >
                  affected: {s.affectedSites.join(' · ')}
                </div>
              )}
              <div
                className="flex items-center gap-2"
                style={{ marginTop: 6 }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background:
                      s.status === 'active'
                        ? 'var(--color-success)'
                        : s.status === 'breached'
                          ? 'var(--color-danger)'
                          : 'var(--color-ink-faint)',
                  }}
                  aria-hidden
                />
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    color: 'var(--color-ink-mute)',
                    textTransform: 'uppercase',
                  }}
                >
                  {s.status} · {s.autoMonitor ? 'auto-monitored' : 'disclosure-based'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-faint)',
          marginTop: 14,
          marginBottom: 0,
          lineHeight: 1.6,
        }}
      >
        These subjectivities are tracked through the policy term. The cockpit
        will surface upcoming critical dates 30 days in advance in the
        lifecycle ribbon.
      </p>
    </section>
  );
}
