import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useIntake } from '@/features/intake';
import { CHECK_ORDER } from '@/lib/appetite';
import { CheckRow } from './CheckRow';
import { VerdictPanel } from './VerdictPanel';
import { runTriageCinematic } from './triage-engine';

/**
 * The triage section. Auto-fires after enrichment is settled AND no
 * unresolved conflicts/gaps remain, once per `enrichment.completed`
 * event. Subsequent runs are explicit via the `rerun triage` link
 * unless a fresh enrichment.completed lands.
 */
export function TriageSection() {
  const intakePhase = useIntake((s) => s.phase);
  const submission = useRanBerri((s) => s.submission);
  const enrichment = useRanBerri((s) => s.enrichment);
  const triage = useRanBerri((s) => s.triage);
  const triageArtifact = useRanBerri((s) => s.artifacts.triage);
  const submissionState = useRanBerri((s) => s.submissionState);
  const auditLog = useRanBerri((s) => s.auditLog);
  const [running, setRunning] = useState(false);
  const firedAtRef = useRef<number>(-1);

  const unresolvedConflicts = enrichment.conflicts.filter(
    (c) => !c.dismissed && !c.resolution,
  );
  const unresolvedGaps = enrichment.gaps.filter(
    (g) => !g.dismissed && !g.resolution,
  );
  const reconciliationDone =
    enrichment.phase === 'settled' &&
    unresolvedConflicts.length === 0 &&
    unresolvedGaps.length === 0;

  // Auto-trigger: once per enrichment.completed event, and only when
  // reconciliation is fully done.
  useEffect(() => {
    if (!submission) return;
    if (intakePhase !== 'complete') return;
    if (!reconciliationDone) return;
    if (submissionState !== 'active') return;

    let lastEnrichmentCompleted = -1;
    let lastTriageStarted = -1;
    for (let i = 0; i < auditLog.length; i++) {
      const e = auditLog[i]!;
      if (e.kind === 'enrichment.completed') lastEnrichmentCompleted = i;
      if (e.kind === 'triage.started') lastTriageStarted = i;
    }
    if (lastEnrichmentCompleted === -1) return;
    if (lastTriageStarted > lastEnrichmentCompleted) return; // already fired
    if (firedAtRef.current === lastEnrichmentCompleted) return;

    firedAtRef.current = lastEnrichmentCompleted;
    setRunning(true);
    void runTriageCinematic().finally(() => setRunning(false));
  }, [
    submission,
    intakePhase,
    reconciliationDone,
    submissionState,
    auditLog,
  ]);

  if (!submission) return null;
  if (intakePhase !== 'complete') return null;
  if (!reconciliationDone && triage.checks.length === 0) return null;

  const isStale = triageArtifact.staleSince !== null;
  const isSettled = triage.phase === 'settled';
  const isEvaluating = triage.phase === 'evaluating' || running;
  const readOnly = submissionState !== 'active';

  return (
    <section className="hairline-t" style={{ marginTop: 28, paddingTop: 22 }}>
      <Header
        running={running}
        isStale={isStale}
        isEvaluating={isEvaluating}
        onRerun={async () => {
          if (running) return;
          setRunning(true);
          try {
            await runTriageCinematic({ rerun: true });
          } finally {
            setRunning(false);
          }
        }}
        readOnly={readOnly}
      />

      {/* Check rows */}
      <div style={{ marginTop: 14 }}>
        {CHECK_ORDER.map((id) => {
          const record = triage.checks.find((c) => c.id === id);
          return (
            <CheckRow
              key={id}
              checkId={id}
              record={record}
              readOnly={readOnly}
            />
          );
        })}
      </div>

      <AnimatePresence>
        {isSettled && triage.verdict && (
          <VerdictPanel
            checks={triage.checks}
            verdict={
              // Recompute using overrides — replay's verdict is the snapshot
              // at triage.completed; overrides since then should win.
              effectiveVerdict(triage.checks) ?? triage.verdict
            }
            readOnly={readOnly}
            verdictChanged={triage.lastVerdictChange}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function effectiveVerdict(
  checks: import('@/store/replay').TriageCheckRecord[],
): 'pass' | 'refer' | 'decline' | null {
  if (checks.length === 0) return null;
  const o = checks.map((c) => c.override?.outcome ?? c.outcome);
  if (o.includes('decline')) return 'decline';
  if (o.includes('refer')) return 'refer';
  return 'pass';
}

function Header({
  running,
  isStale,
  isEvaluating,
  onRerun,
  readOnly,
}: {
  running: boolean;
  isStale: boolean;
  isEvaluating: boolean;
  onRerun: () => void;
  readOnly: boolean;
}) {
  const subtitle = isEvaluating
    ? 'checking against bound authority'
    : isStale
      ? 'stale — upstream changed'
      : 'rules-based; the AI explains, the underwriter overrides';

  return (
    <div className="flex items-baseline justify-between">
      <div>
        <div className="eyebrow">triage</div>
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
      {!isEvaluating && !readOnly && (
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
          <span>rerun triage</span>
        </button>
      )}
    </div>
  );
}
