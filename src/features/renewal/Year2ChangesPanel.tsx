import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRanBerri } from '@/store';
import { effectiveValue } from '@/lib/field';
import { captureYear2Changes, rateYear2 } from '@/lib/renewal';

const GBP = (n: number | null) =>
  n === null ? '—' : `£${n.toLocaleString('en-GB')}`;

/**
 * Year-2 changes panel — BEFORE/AFTER comparison of the year-1 attributes
 * against what the broker has confirmed for renewal. Renders a "capture
 * changes" affordance when no changes have been captured yet, then
 * shows the comparison once captureYear2Changes has fired.
 */
export function Year2ChangesPanel() {
  const submission = useRanBerri((s) => s.submission);
  const renewal = useRanBerri((s) => s.renewal);
  const [capturing, setCapturing] = useState(false);
  const [rating, setRating] = useState(false);

  if (!submission) return null;
  if (renewal.phase === 'idle' || renewal.phase === 'triggered') return null;

  const year1Turnover = effectiveValue(submission.insured.turnover) as number | null;
  const year1Materials = (effectiveValue(submission.materials) as string[] | null) ?? [];
  const changes = renewal.insuredChanges;
  const captured = changes.newTurnover !== null;
  const ratedDone = renewal.year2.technicalPremium !== null;

  async function onCapture() {
    if (capturing) return;
    setCapturing(true);
    try {
      captureYear2Changes();
      // Continue automatically into year-2 rating; the cinematic feel
      // is "broker confirmed, engine rates" in one motion.
      await new Promise((r) => setTimeout(r, 220));
      setRating(true);
      rateYear2();
    } finally {
      setCapturing(false);
      setRating(false);
    }
  }

  if (!captured) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="hairline-t"
        style={{ padding: '22px 28px' }}
      >
        <header style={{ marginBottom: 12 }}>
          <div className="eyebrow">year-2 changes · awaiting broker</div>
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
            broker confirms the year-2 attributes; the cockpit projects from there
          </div>
        </header>
        <button
          type="button"
          onClick={onCapture}
          disabled={capturing}
          className="inline-flex items-center"
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--color-bg)',
            background: capturing ? 'var(--color-ink-faint)' : 'var(--color-accent)',
            border: '0.5px solid var(--color-accent)',
            cursor: capturing ? 'wait' : 'pointer',
          }}
        >
          {capturing ? 'Capturing changes…' : 'Capture broker-confirmed changes →'}
        </button>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="hairline-t"
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">year-2 changes · what the broker confirmed</div>
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
          before / after — coral marks what shifts at renewal
        </div>
      </header>

      <div
        className="hairline"
        style={{
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-surface)',
          padding: '14px 16px',
          display: 'grid',
          gridTemplateColumns: '140px 1fr 1fr',
          rowGap: 14,
          columnGap: 16,
          alignItems: 'baseline',
        }}
      >
        <span />
        <ColumnHeader label="year 1" />
        <ColumnHeader label="year 2" />

        <DiffRow
          label="turnover"
          before={GBP(year1Turnover)}
          after={GBP(changes.newTurnover)}
          changed={changes.newTurnover !== year1Turnover}
        />
        <DiffRow
          label="material classes"
          before={year1Materials.join(', ') || '—'}
          after={
            changes.materialAdditions.length > 0
              ? `${year1Materials.join(', ')} + ${changes.materialAdditions.join(', ')}`
              : year1Materials.join(', ')
          }
          changed={changes.materialAdditions.length > 0}
        />
        <DiffRow
          label="broker target"
          before="—"
          after={GBP(changes.brokerTargetPremium)}
          changed={changes.brokerTargetPremium !== null}
        />
      </div>

      {changes.materialAdditions.some((m) => m.toLowerCase().includes('weee')) && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-warn-bg)',
            border: '0.5px solid var(--color-warn)',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-warn)',
              marginBottom: 4,
            }}
          >
            appetite flag · weee class
          </div>
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-ink)',
              lineHeight: 1.55,
              letterSpacing: '-0.005em',
            }}
          >
            WEEE additions trigger a year-2 conditional warranty (sealed-store
            requirement, monthly stock rotation evidence). Year-2 rating
            re-credits the year-1 LR while applying the new material loading.
          </div>
        </div>
      )}

      {changes.competitivePressure && (
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
          {changes.competitivePressure}
        </p>
      )}

      {!ratedDone && (
        <div style={{ marginTop: 12 }}>
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-ink-mute)',
            }}
          >
            {rating ? 'rating year 2…' : 'awaiting year-2 rating'}
          </span>
        </div>
      )}

      {ratedDone && (
        <div
          className="hairline-t"
          style={{
            marginTop: 14,
            paddingTop: 12,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-ink-mute)',
              letterSpacing: '-0.005em',
            }}
          >
            year-2 technical premium
          </div>
          <div
            className="mono"
            style={{
              fontSize: 14,
              color: 'var(--color-ink)',
              letterSpacing: '0.04em',
            }}
          >
            {GBP(renewal.year2.technicalPremium)}
            {renewal.year2.deltaFromYear1Annual !== null && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  color:
                    renewal.year2.deltaFromYear1Annual >= 0
                      ? 'var(--color-warn)'
                      : 'var(--color-success)',
                }}
              >
                ({renewal.year2.deltaFromYear1Annual >= 0 ? '+' : ''}
                {GBP(renewal.year2.deltaFromYear1Annual)} vs y1)
              </span>
            )}
          </div>
        </div>
      )}
    </motion.section>
  );
}

function ColumnHeader({ label }: { label: string }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 9.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-faint)',
      }}
    >
      {label}
    </div>
  );
}

function DiffRow({
  label,
  before,
  after,
  changed,
}: {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}) {
  return (
    <>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
        }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          letterSpacing: '0.04em',
        }}
      >
        {before}
      </div>
      <div
        className="serif"
        style={{
          fontSize: 13.5,
          color: changed ? 'var(--color-accent)' : 'var(--color-ink)',
          letterSpacing: '-0.005em',
        }}
      >
        {after}
      </div>
    </>
  );
}
