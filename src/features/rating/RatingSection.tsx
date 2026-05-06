import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useReadOnly } from '@/lib/readOnly';
import { Button } from '@/components';
import type { CellReplayRecord } from '@/store/replay';
import { CellRow } from './CellRow';
import { RatingVerdict } from './RatingVerdict';
import { CellInspector } from './CellInspector';
import { generateSlipAndEmail, runRatingCinematic } from './rating-engine';

/**
 * Rating section. Pending until triage's `triage.passedToRating` event
 * fires, at which point it auto-runs the cinematic. Subsequent reruns
 * are explicit via the rerun link.
 */
export function RatingSection() {
  const submission = useRanBerri((s) => s.submission);
  const submissionState = useRanBerri((s) => s.submissionState);
  const rating = useRanBerri((s) => s.rating);
  const ratingArtifact = useRanBerri((s) => s.artifacts.rating);
  const auditLog = useRanBerri((s) => s.auditLog);
  const quotePhase = useRanBerri((s) => s.quote.phase);
  const firedAtRef = useRef<number>(-1);
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [inspectedCell, setInspectedCell] = useState<string | null>(null);
  const readOnly = useReadOnly();

  const passedToRating =
    submissionState === 'rating-pending' || submissionState === 'quote-sent';

  // Auto-fire once per `triage.passedToRating` event.
  useEffect(() => {
    if (!submission) return;
    if (!passedToRating) return;
    let lastPassedIdx = -1;
    let lastRatingStartedIdx = -1;
    for (let i = 0; i < auditLog.length; i++) {
      const e = auditLog[i]!;
      if (e.kind === 'triage.passedToRating') lastPassedIdx = i;
      if (e.kind === 'rating.started') lastRatingStartedIdx = i;
    }
    if (lastPassedIdx === -1) return;
    if (lastRatingStartedIdx > lastPassedIdx) return;
    if (firedAtRef.current === lastPassedIdx) return;
    firedAtRef.current = lastPassedIdx;
    setRunning(true);
    void runRatingCinematic().finally(() => setRunning(false));
  }, [submission, passedToRating, auditLog]);

  if (!submission) return null;

  // Pending state: visible if passedToRating but rating hasn't started
  // yet. Hide otherwise.
  if (rating.phase === 'pending' && rating.cells.length === 0) {
    if (!passedToRating) return null;
    return (
      <section
        className="hairline-t"
        style={{ marginTop: 28, paddingTop: 22 }}
      >
        <Header
          isStale={false}
          isCalculating
          readOnly={readOnly}
          quoteIsSent={quotePhase === 'sent'}
          onRerun={() => {}}
        />
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            marginTop: 14,
          }}
        >
          awaiting triage verdict&hellip;
        </div>
      </section>
    );
  }

  // If quote already generated, collapse the rating section to a one-liner.
  if (
    quotePhase === 'slip-ready' ||
    quotePhase === 'sending' ||
    quotePhase === 'sent'
  ) {
    return <RatingCollapsedSummary />;
  }

  const isStale = ratingArtifact.staleSince !== null;
  const isSettled = rating.phase === 'settled' && rating.output !== null;
  const isCalculating = rating.phase === 'evaluating' || running;
  const cells: CellReplayRecord[] = rating.cells;
  const inspected =
    inspectedCell !== null ? cells.find((c) => c.ref === inspectedCell) ?? null : null;

  return (
    <section
      className="hairline-t"
      style={{ marginTop: 28, paddingTop: 22, position: 'relative' }}
    >
      <Header
        isStale={isStale}
        isCalculating={isCalculating}
        readOnly={readOnly}
        quoteIsSent={false}
        onRerun={async () => {
          if (running || readOnly) return;
          setRunning(true);
          try {
            await runRatingCinematic({ rerun: true });
          } finally {
            setRunning(false);
          }
        }}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 28,
          marginTop: 16,
          opacity: isStale ? 0.55 : 1,
          pointerEvents: isStale ? 'none' : 'auto',
          transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Build-up table */}
        <div>
          <div
            className="mono"
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 100px 100px',
              gap: 14,
              padding: '0 8px',
              fontSize: 9.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-faint)',
              marginBottom: 6,
            }}
          >
            <span>cell</span>
            <span>label</span>
            <span style={{ textAlign: 'right' }}>value</span>
            <span style={{ textAlign: 'right' }}>subtotal</span>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderTop: '0.5px solid var(--color-rule)',
              borderBottom: '0.5px solid var(--color-rule)',
              padding: '4px 0',
            }}
          >
            {cells.map((cell) => (
              <CellRow
                key={cell.ref}
                cell={cell}
                isFinal={cell.ref === 'H58'}
                onOpen={(ref) => setInspectedCell(ref)}
              />
            ))}
          </div>
        </div>

        {/* Verdict card */}
        <div>
          <RatingVerdict
            premium={rating.output?.premium ?? null}
            sha={
              rating.iteration > 1 && rating.output
                ? `${rating.output.sha}-r${rating.iteration}`
                : (rating.output?.sha ?? 'sha-7f2a')
            }
            version={rating.output?.version ?? 'v3.2'}
            tier={rating.output?.tier ?? 'Tier-2'}
            isCalculating={isCalculating}
          />
          {isSettled && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2"
              style={{ marginTop: 14 }}
            >
              <Button
                variant="primary"
                size="md"
                disabled={readOnly || isStale || generating}
                onClick={() => {
                  setGenerating(true);
                  try {
                    generateSlipAndEmail();
                  } finally {
                    setGenerating(false);
                  }
                }}
              >
                Generate quote slip →
              </Button>
              <Button
                variant="ghost"
                size="md"
                disabled={readOnly || running}
                onClick={async () => {
                  setRunning(true);
                  try {
                    await runRatingCinematic({ rerun: true });
                  } finally {
                    setRunning(false);
                  }
                }}
              >
                Re-rate
              </Button>
            </motion.div>
          )}
        </div>
      </div>

      <CellInspector
        cell={inspected}
        onClose={() => setInspectedCell(null)}
      />
    </section>
  );
}

function Header({
  isStale,
  isCalculating,
  readOnly,
  quoteIsSent,
  onRerun,
}: {
  isStale: boolean;
  isCalculating: boolean;
  readOnly: boolean;
  quoteIsSent: boolean;
  onRerun: () => void;
}) {
  const subtitle = isCalculating
    ? 'Tier-2 · v3.2 · sealed at sha-7f2a'
    : isStale
      ? 'stale — upstream changed'
      : 'Tier-2 · v3.2 · sealed at sha-7f2a';

  return (
    <div className="flex items-baseline justify-between">
      <div>
        <div className="eyebrow">rating</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14.5,
            color: isStale ? 'var(--color-warn)' : 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          {subtitle}
        </div>
      </div>
      {!isCalculating && !readOnly && !quoteIsSent && (
        <button
          type="button"
          onClick={onRerun}
          className="inline-flex items-center gap-1.5"
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-accent)',
          }}
        >
          <RotateCcw size={11} strokeWidth={1.5} />
          <span>rerun rating</span>
        </button>
      )}
    </div>
  );
}

function RatingCollapsedSummary() {
  const rating = useRanBerri((s) => s.rating);
  const ratingArtifact = useRanBerri((s) => s.artifacts.rating);
  if (!rating.output) return null;
  const isStale = ratingArtifact.staleSince !== null;
  const stamp = rating.output.computedAt
    ? new Date(rating.output.computedAt).toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <section
      className="hairline-t"
      style={{ marginTop: 28, paddingTop: 18 }}
    >
      <div className="flex items-baseline gap-3" style={{ flexWrap: 'wrap' }}>
        <span className="eyebrow">rating</span>
        <span
          className="serif"
          style={{
            fontSize: 13.5,
            color: isStale ? 'var(--color-warn)' : 'var(--color-ink)',
          }}
        >
          Premium £{rating.output.premium.toLocaleString()}
        </span>
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
          }}
        >
          · sealed {rating.output.version}
          {rating.iteration > 1 ? ` · iteration ${rating.iteration}` : ''}
          {stamp ? ` · ${stamp}` : ''}
        </span>
        {isStale && (
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--color-warn)',
            }}
          >
            (stale — rerun before sending)
          </span>
        )}
      </div>
    </section>
  );
}
