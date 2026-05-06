import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useReadOnly } from '@/lib/readOnly';
import { runRecommendationCinematic } from './recommendation-engine';
import { FactorRow } from './FactorRow';
import { NarrativePanel } from './NarrativePanel';
import { VerdictPanel } from './VerdictPanel';
import { DeepDiveInspector } from './DeepDiveInspector';

const FACTOR_DEFAULTS: Array<{ id: string; label: string }> = [
  { id: 'FCT-001', label: 'Profile match strength' },
  { id: 'FCT-002', label: 'Historical performance' },
  { id: 'FCT-003', label: 'Pricing competitiveness' },
  { id: 'FCT-004', label: 'Subjectivity risk' },
  { id: 'FCT-005', label: 'Broker relationship' },
];

export function RecommendationSection() {
  const submission = useRanBerri((s) => s.submission);
  const quote = useRanBerri((s) => s.quote);
  const recommendation = useRanBerri((s) => s.recommendation);
  const recommendationArtifact = useRanBerri((s) => s.artifacts.recommendation);
  const submissionState = useRanBerri((s) => s.submissionState);
  const auditLog = useRanBerri((s) => s.auditLog);
  const readOnly = useReadOnly();
  const [running, setRunning] = useState(false);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const firedAtRef = useRef<number>(-1);

  // Auto-trigger: once per `slip.generated` event. Recommendation can
  // fire even before the broker sees the quote — the underwriter
  // benefits from the internal recommendation regardless.
  useEffect(() => {
    if (!submission) return;
    if (!quote.slipRef) return;
    if (submissionState !== 'active' && submissionState !== 'rating-pending' && submissionState !== 'quote-sent') {
      return;
    }
    let lastSlip = -1;
    let lastRecStarted = -1;
    for (let i = 0; i < auditLog.length; i++) {
      const e = auditLog[i]!;
      if (e.kind === 'slip.generated') lastSlip = i;
      if (e.kind === 'recommendation.started') lastRecStarted = i;
    }
    if (lastSlip === -1) return;
    if (lastRecStarted > lastSlip) return;
    if (firedAtRef.current === lastSlip) return;
    firedAtRef.current = lastSlip;
    setRunning(true);
    void runRecommendationCinematic().finally(() => setRunning(false));
  }, [submission, quote.slipRef, submissionState, auditLog]);

  if (!submission) return null;
  if (!quote.slipRef) return null;
  if (recommendation.phase === 'idle' && recommendation.factors.length === 0) {
    return null;
  }

  const isStale = recommendationArtifact.staleSince !== null;
  const isCalculating = recommendation.phase === 'evaluating' || running;
  const isSettled = recommendation.phase === 'settled' && recommendation.primary !== null;

  // Once the underwriter has acted, collapse the section to a single
  // confirmation strip so the bind ceremony can claim the canvas.
  if (recommendation.action) {
    return <ActedSummary />;
  }

  return (
    <section
      className="hairline-t"
      style={{ marginTop: 28, paddingTop: 22, position: 'relative' }}
    >
      <Header
        running={running}
        isCalculating={isCalculating}
        isStale={isStale}
        readOnly={readOnly}
        onRerun={async () => {
          if (running) return;
          setRunning(true);
          try {
            await runRecommendationCinematic({ rerun: true });
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
        {/* Factor rows */}
        <div>
          <div
            className="mono"
            style={{
              display: 'grid',
              gridTemplateColumns: '14px 64px 200px 90px 36px 1fr 16px',
              gap: 12,
              padding: '0 4px 6px',
              fontSize: 9.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-faint)',
            }}
          >
            <span />
            <span>id</span>
            <span>factor</span>
            <span>vote</span>
            <span>w</span>
            <span>rationale</span>
            <span />
          </div>
          {FACTOR_DEFAULTS.map((d) => (
            <FactorRow
              key={d.id}
              factorId={d.id}
              defaultLabel={d.label}
              record={recommendation.factors.find((f) => f.id === d.id)}
            />
          ))}
        </div>

        {/* Narrative panel */}
        <NarrativePanel
          headline={recommendation.headline}
          isCalculating={isCalculating}
        />
      </div>

      {isSettled && recommendation.primary && recommendation.confidence && (
        <VerdictPanel
          verdict={recommendation.primary}
          confidence={recommendation.confidence}
          factors={recommendation.factors}
          readOnly={readOnly}
          verdictChanged={recommendation.lastVerdictChange}
          onOpenDeepDive={() => setDeepDiveOpen(true)}
        />
      )}

      {deepDiveOpen && (
        <DeepDiveInspector onClose={() => setDeepDiveOpen(false)} />
      )}
    </section>
  );
}

function ActedSummary() {
  const action = useRanBerri((s) => s.recommendation.action);
  if (!action) return null;
  const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const label =
    action.kind === 'bind'
      ? 'BIND'
      : action.kind === 'refer'
        ? 'REFER'
        : 'NTU';
  return (
    <section
      className="hairline-t"
      style={{
        marginTop: 28,
        paddingTop: 14,
        paddingBottom: 4,
      }}
    >
      <div
        className="flex items-baseline gap-3"
        style={{
          padding: '6px 10px',
          borderRadius: 'var(--radius-button)',
          background: 'var(--color-success-bg)',
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-success)',
          }}
        >
          ✓ recommendation acted on
        </span>
        <span
          className="serif"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-success)',
            letterSpacing: '-0.005em',
          }}
        >
          {label}
        </span>
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-success)',
          }}
        >
          · {TIME_FMT.format(new Date(action.actedAt))}
        </span>
      </div>
    </section>
  );
}

function Header({
  running,
  isCalculating,
  isStale,
  readOnly,
  onRerun,
}: {
  running: boolean;
  isCalculating: boolean;
  isStale: boolean;
  readOnly: boolean;
  onRerun: () => void;
}) {
  const subtitle = isCalculating
    ? 'grounded in similar binders + recent losses · Sonnet'
    : isStale
      ? 'stale — upstream changed'
      : 'grounded in your own book';
  return (
    <div className="flex items-baseline justify-between">
      <div>
        <div className="eyebrow">recommendation</div>
        <motion.div
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
        </motion.div>
      </div>
      {!isCalculating && !readOnly && (
        <button
          type="button"
          onClick={onRerun}
          disabled={running}
          className="inline-flex items-center gap-1.5"
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 12.5,
            color: running ? 'var(--color-ink-faint)' : 'var(--color-accent)',
          }}
        >
          <RotateCcw size={11} strokeWidth={1.5} />
          <span>rerun recommendation</span>
        </button>
      )}
    </div>
  );
}
