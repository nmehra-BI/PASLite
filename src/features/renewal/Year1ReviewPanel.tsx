import { motion } from 'framer-motion';
import { useRanBerri } from '@/store';

const GBP = (n: number) => `£${n.toLocaleString('en-GB')}`;
const PCT = (n: number) => `${(n * 100).toFixed(0)}%`;
const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Year-1 review panel — the editorial 4-row card the spec calls for.
 * Reads renewal.year1Review (computed by buildYear1Review and
 * applied to the store via the renewal.year1ReviewBuilt event).
 */
export function Year1ReviewPanel() {
  const review = useRanBerri((s) => s.renewal.year1Review);
  const policy = useRanBerri((s) => s.policy);
  const subjectivities = useRanBerri((s) => s.postBind.subjectivities);
  const renewalPhase = useRanBerri((s) => s.renewal.phase);

  if (!review) return null;
  if (renewalPhase === 'idle' || renewalPhase === 'triggered') return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="hairline-t"
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">year-1 review · how the policy performed</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14.5,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          projected from the audit log
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* FINANCIAL */}
        <Row label="financial">
          <KV name="earned premium">{GBP(review.earnedPremium)}</KV>
          <KV name="total losses">{GBP(review.totalLosses)}</KV>
          <KV name="loss ratio" emphasis={review.lossRatio < 0.5 ? 'good' : 'warn'}>
            {PCT(review.lossRatio)}
          </KV>
          <KV name="claim count">{review.claimCount}</KV>
        </Row>

        {/* CLAIMS HISTORY */}
        {review.claims.length > 0 && (
          <Row label="claims history">
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {review.claims.map((c) => (
                <li
                  key={c.ref}
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    color: 'var(--color-ink-soft)',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span style={{ color: 'var(--color-ink-faint)' }}>{c.ref}</span>
                  {' · '}
                  <span style={{ color: 'var(--color-ink)' }}>{c.siteName}</span>
                  {' · '}
                  {DATE_FMT.format(new Date(c.date))}
                  {' · '}
                  {c.category}
                  {' · '}
                  <span style={{ color: 'var(--color-ink)' }}>{GBP(c.amount)}</span>
                </li>
              ))}
            </ul>
          </Row>
        )}

        {/* ENDORSEMENTS */}
        <Row label="endorsements">
          {review.mtaCount === 0 ? (
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 13,
                color: 'var(--color-ink-mute)',
              }}
            >
              none in year 1
            </span>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {policy.versions.map((v) => (
                <li
                  key={v.endorsementNumber}
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    color: 'var(--color-ink-soft)',
                    letterSpacing: '0.04em',
                  }}
                >
                  MTA-0{v.endorsementNumber} · AP {GBP(v.proRatedAP)} ·{' '}
                  {v.changeType}
                </li>
              ))}
            </ul>
          )}
        </Row>

        {/* SUBJECTIVITIES STATUS */}
        <Row label="subjectivities status">
          <div
            className="serif"
            style={{ fontSize: 13.5, color: 'var(--color-ink)' }}
          >
            {review.subjectivitiesSatisfied} of {review.subjectivitiesTotal}{' '}
            satisfied
          </div>
          {subjectivities.length > 0 && (
            <ul
              style={{
                margin: '6px 0 0',
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              {subjectivities.map((s) => (
                <li
                  key={s.id}
                  className="serif"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 12,
                    color:
                      s.status === 'satisfied'
                        ? 'var(--color-success)'
                        : 'var(--color-ink-mute)',
                  }}
                >
                  {s.status === 'satisfied' ? '✓' : '◌'} {s.description}
                </li>
              ))}
            </ul>
          )}
        </Row>

        {/* BROKER RELATIONSHIP */}
        <Row label="broker relationship">
          <div
            className="serif"
            style={{ fontSize: 13.5, color: 'var(--color-ink)' }}
          >
            {review.brokerRelationship.name}{' '}
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: '0.06em',
                color:
                  review.brokerRelationship.sentiment === 'strong'
                    ? 'var(--color-success)'
                    : review.brokerRelationship.sentiment === 'strained'
                      ? 'var(--color-warn)'
                      : 'var(--color-ink-mute)',
                marginLeft: 6,
              }}
            >
              {review.brokerRelationship.sentiment.toUpperCase()}
            </span>
          </div>
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-ink-mute)',
              marginTop: 4,
              lineHeight: 1.55,
            }}
          >
            {review.brokerRelationship.note}
          </div>
        </Row>
      </div>

      <Marginalia text={review.marginalia} />
    </motion.section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="hairline"
      style={{
        borderRadius: 'var(--radius-card)',
        padding: '12px 14px',
        background: 'var(--color-surface)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px 28px',
          alignItems: 'baseline',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function KV({
  name,
  emphasis,
  children,
}: {
  name: string;
  emphasis?: 'good' | 'warn';
  children: React.ReactNode;
}) {
  const color =
    emphasis === 'good'
      ? 'var(--color-success)'
      : emphasis === 'warn'
        ? 'var(--color-warn)'
        : 'var(--color-ink)';
  return (
    <div style={{ minWidth: 0 }}>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          marginBottom: 2,
        }}
      >
        {name}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 13,
          color,
          letterSpacing: '0.04em',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Marginalia({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p
      className="serif"
      style={{
        fontStyle: 'italic',
        fontSize: 13,
        color: 'var(--color-ink-mute)',
        margin: '14px 0 0',
        lineHeight: 1.6,
        letterSpacing: '-0.005em',
      }}
    >
      {text}
    </p>
  );
}
