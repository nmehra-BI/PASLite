import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useRanBerri } from '@/store';
import {
  buildPolicyContextDiff,
  resolveMtaGap,
  runDeltaRating,
  recheckCapacity,
  generateMtaSchedule,
} from '@/lib/mta';
import { getManchesterMtaRequest } from '@/lib/fixtures';
import { Button } from '@/components';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * The BEFORE/AFTER comparison card that anchors the MTA workflow.
 * Renders the bound policy state on the left, the proposed state
 * on the right, with changed values highlighted in coral and the
 * new Manchester row marked "← NEW".
 *
 * Below the card, the pending-permit gap surfaces with three
 * resolution options (conditional / wait / decline). On resolve,
 * the workflow advances to delta rating.
 */
export function PolicyContextReview() {
  const submission = useRanBerri((s) => s.submission);
  const mta = useRanBerri((s) => s.mta);
  const quote = useRanBerri((s) => s.quote);
  const [advancing, setAdvancing] = useState(false);

  const diff = useMemo(() => {
    if (!submission || !mta.request) return null;
    return buildPolicyContextDiff({
      submission,
      mta: getManchesterMtaRequest(),
      boundPremium: quote.slipPremium ?? 0,
    });
  }, [submission, mta.request, quote.slipPremium]);

  if (!submission || !mta.request || !diff) return null;
  if (
    mta.phase !== 'extracted' &&
    mta.phase !== 'gap-pending' &&
    mta.phase !== 'context-review'
  ) {
    return null;
  }

  const pendingGap = mta.gaps.find((g) => g.resolution === null);

  function advanceToDeltaRating() {
    if (advancing) return;
    setAdvancing(true);
    try {
      runDeltaRating();
      const cap = recheckCapacity();
      if (!cap.sufficient) return;
      generateMtaSchedule();
    } finally {
      setAdvancing(false);
    }
  }

  const allResolved = mta.gaps.every((g) => g.resolution !== null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">policy · change proposed</div>
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
          site addition · effective {DATE_FMT.format(new Date(mta.request.effectiveDate))}
        </div>
      </header>

      <div
        className="hairline"
        style={{
          padding: 0,
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-surface)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          overflow: 'hidden',
        }}
      >
        <Column
          side="before"
          title="BEFORE (current bound)"
          turnover={diff.before.turnover}
          deltaTurnoverAbs={null}
          siteCount={diff.before.siteCount}
          deltaSites={null}
          sites={diff.before.sites.map((s) => ({ ...s, isNew: false }))}
          totalSqm={diff.before.totalSqm}
          deltaSqmAbs={null}
          deltaSqmPct={null}
          materials={diff.before.materials}
          fireSuppression={diff.before.fireSuppression}
          permitGapPending={false}
        />
        <Column
          side="after"
          title="AFTER (with MTA-04 applied)"
          turnover={diff.after.turnover}
          deltaTurnoverAbs={diff.deltas.turnoverAbs}
          siteCount={diff.after.siteCount}
          deltaSites={diff.deltas.siteCountAbs}
          sites={diff.after.sites.map((s, i) => ({
            ...s,
            isNew: i === diff.after.addedSiteIndex,
          }))}
          totalSqm={diff.after.totalSqm}
          deltaSqmAbs={diff.deltas.sqmAbs}
          deltaSqmPct={diff.deltas.sqmPct}
          materials={diff.after.materials}
          fireSuppression={diff.after.fireSuppression}
          permitGapPending={true}
        />
      </div>

      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-faint)',
          marginTop: 14,
          marginBottom: 0,
          lineHeight: 1.6,
        }}
      >
        Turnover increase reflects management&rsquo;s projection for the
        remainder of the policy year. The pending Manchester permit is a
        material gap — see warranty proposal below.
      </p>

      {pendingGap && <GapResolveCard gap={pendingGap} />}

      {allResolved && mta.phase === 'context-review' && (
        <div
          className="hairline-t"
          style={{
            marginTop: 18,
            paddingTop: 14,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            variant="primary"
            size="sm"
            disabled={advancing}
            onClick={advanceToDeltaRating}
          >
            Run delta rating →
          </Button>
        </div>
      )}
    </motion.section>
  );
}

type ColumnProps = {
  side: 'before' | 'after';
  title: string;
  turnover: number;
  deltaTurnoverAbs: number | null;
  siteCount: number;
  deltaSites: number | null;
  sites: Array<{ name: string; sqm: number | null; permitRef: string | null; permitExpiry: string | null; isNew: boolean }>;
  totalSqm: number;
  deltaSqmAbs: number | null;
  deltaSqmPct: number | null;
  materials: string[];
  fireSuppression: 'present' | 'absent' | 'undisclosed';
  permitGapPending: boolean;
};

function Column(props: ColumnProps) {
  const isAfter = props.side === 'after';
  return (
    <div
      style={{
        padding: '16px 18px',
        borderLeft: isAfter ? '0.5px solid var(--color-rule-mid)' : 'none',
        fontFamily: isAfter ? 'var(--font-serif)' : 'var(--font-mono)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          marginBottom: 12,
        }}
      >
        {props.title}
      </div>

      <Row label="turnover" changed={props.deltaTurnoverAbs !== null && props.deltaTurnoverAbs !== 0}>
        £{props.turnover.toLocaleString('en-GB')}
        {props.deltaTurnoverAbs !== null && props.deltaTurnoverAbs !== 0 && (
          <Delta>
            {props.deltaTurnoverAbs > 0 ? '+' : ''}£{(props.deltaTurnoverAbs / 1_000_000).toFixed(2)}M
          </Delta>
        )}
      </Row>

      <Row label={`sites · ${props.siteCount}`} changed={props.deltaSites !== null && props.deltaSites !== 0}>
        {props.deltaSites !== null && props.deltaSites !== 0 && (
          <Delta>({props.deltaSites > 0 ? '+' : ''}{props.deltaSites})</Delta>
        )}
      </Row>

      <div style={{ marginLeft: 8 }}>
        {props.sites.map((s) => (
          <div
            key={s.name}
            style={{
              fontSize: 12.5,
              color: s.isNew ? 'var(--color-ink)' : 'var(--color-ink-soft)',
              padding: '2px 6px',
              borderLeft: s.isNew ? '1.5px solid var(--color-accent)' : 'none',
              marginLeft: s.isNew ? -8 : 0,
              fontStyle: isAfter ? 'normal' : 'normal',
            }}
          >
            {s.name} {s.sqm !== null && `${s.sqm.toLocaleString('en-GB')} sqm`}
            {s.isNew && (
              <span
                className="serif"
                style={{
                  fontStyle: 'italic',
                  fontSize: 11,
                  color: 'var(--color-accent)',
                  marginLeft: 8,
                }}
              >
                ← NEW
              </span>
            )}
          </div>
        ))}
      </div>

      <Row
        label="total sqm"
        changed={props.deltaSqmAbs !== null && props.deltaSqmAbs !== 0}
      >
        {props.totalSqm.toLocaleString('en-GB')}
        {props.deltaSqmAbs !== null && props.deltaSqmAbs !== 0 && props.deltaSqmPct !== null && (
          <Delta>
            +{(props.deltaSqmPct * 100).toFixed(1)}%
          </Delta>
        )}
      </Row>

      <Row label="materials" changed={false}>
        <span style={{ fontSize: 12.5 }}>mixed dry recyclables</span>
      </Row>

      <Row label="fire suppression" changed={false}>
        <span style={{ fontSize: 12.5 }}>{props.fireSuppression}</span>
      </Row>

      <Row label="ea permits" changed={props.permitGapPending}>
        <div style={{ marginLeft: 8 }}>
          {props.sites.map((s) => (
            <div
              key={`p-${s.name}`}
              style={{
                fontSize: 12,
                color: 'var(--color-ink-soft)',
                padding: '1px 0',
              }}
            >
              {s.name} ·{' '}
              {s.isNew ? (
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: 'var(--color-warn)' }}
                >
                  <AlertTriangle size={10} strokeWidth={1.5} />
                  pending
                </span>
              ) : s.permitExpiry ? (
                'valid'
              ) : s.permitRef ? (
                'valid'
              ) : (
                '—'
              )}
            </div>
          ))}
        </div>
      </Row>
    </div>
  );
}

function Row({
  label,
  changed,
  children,
}: {
  label: string;
  changed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: 10,
        paddingLeft: changed ? 6 : 0,
        borderLeft: changed ? '1px solid var(--color-accent)' : 'none',
        marginLeft: changed ? -7 : 0,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-ink)', marginTop: 2 }}>
        {children}
      </div>
    </div>
  );
}

function Delta({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="serif"
      style={{
        fontStyle: 'italic',
        fontSize: 12,
        color: 'var(--color-accent)',
        marginLeft: 8,
        letterSpacing: '-0.005em',
      }}
    >
      {children}
    </span>
  );
}

function GapResolveCard({ gap }: { gap: { id: string; description: string } }) {
  const [reason, setReason] = useState(
    'broker confirmed install date matches permit application timeline',
  );
  const [error, setError] = useState<string | null>(null);

  function resolve(choice: 'conditional' | 'wait' | 'decline') {
    setError(null);
    try {
      resolveMtaGap({ gapId: gap.id, choice, reason: reason.trim(), resolvedBy: 'nm' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div
      className="hairline"
      style={{
        marginTop: 18,
        padding: '14px 16px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-warn-bg)',
      }}
    >
      <div className="flex items-baseline gap-2">
        <AlertTriangle size={11} strokeWidth={1.5} style={{ color: 'var(--color-warn)' }} />
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-warn)',
          }}
        >
          gap · resolve before proceeding
        </span>
      </div>
      <div
        className="serif"
        style={{
          fontSize: 13.5,
          color: 'var(--color-ink)',
          marginTop: 4,
          letterSpacing: '-0.005em',
        }}
      >
        {gap.description}
      </div>

      <label
        className="eyebrow"
        htmlFor="mta-gap-reason"
        style={{ display: 'block', marginTop: 12, marginBottom: 4 }}
      >
        reason (≥8 chars)
      </label>
      <textarea
        id="mta-gap-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="hairline"
        style={{
          width: '100%',
          resize: 'vertical',
          padding: '6px 10px',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          fontSize: 12.5,
          lineHeight: 1.55,
          color: 'var(--color-ink-soft)',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-button)',
        }}
      />

      <div className="flex items-center gap-2" style={{ marginTop: 10 }}>
        <Button variant="primary" size="sm" onClick={() => resolve('conditional')}>
          Mark as conditional →
        </Button>
        <Button variant="secondary" size="sm" onClick={() => resolve('wait')}>
          Wait for permit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => resolve('decline')}>
          Decline MTA
        </Button>
      </div>
      {error && (
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-danger)',
            margin: '8px 0 0',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
