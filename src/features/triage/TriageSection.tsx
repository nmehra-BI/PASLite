import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useAutonomy } from '@/store/autonomy';
import { useIntake } from '@/features/intake';
import { CHECK_ORDER } from '@/lib/appetite';
import { CheckRow } from './CheckRow';
import { VerdictPanel } from './VerdictPanel';
import { runTriageCinematic } from './triage-engine';
import {
  AutonomyEyebrow,
  RecallModal,
} from '@/features/autonomy';
import { fireAutonomousAction } from '@/lib/autonomy/runAutonomousAction';

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

  return <TriageSectionInner
    submissionId={submission.id}
    isStale={isStale}
    isSettled={isSettled}
    isEvaluating={isEvaluating}
    readOnly={readOnly}
    running={running}
    triage={triage}
    setRunning={setRunning}
  />;
}

function TriageSectionInner({
  submissionId,
  isStale,
  isSettled,
  isEvaluating,
  readOnly,
  running,
  triage,
  setRunning,
}: {
  submissionId: string;
  isStale: boolean;
  isSettled: boolean;
  isEvaluating: boolean;
  readOnly: boolean;
  running: boolean;
  triage: ReturnType<typeof useRanBerri.getState>['triage'];
  setRunning: (b: boolean) => void;
}) {
  const fired = useAutonomy((s) => s.firedByRef[submissionId]);
  const isAutonomous = !!fired && !fired.recalled;

  return (
    <section
      className="hairline-t"
      style={{
        marginTop: 28,
        paddingTop: 22,
        position: 'relative',
        borderLeft: isAutonomous ? '2px solid var(--color-accent)' : 'none',
        paddingLeft: isAutonomous ? 18 : 0,
        transition: 'border-color 200ms ease, padding-left 200ms ease',
      }}
    >
      <AutonomyBanner entryRef={submissionId} />
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

      {/* Stale overlay: while staleSince is set, the rendered checks +
          verdict reflect pre-correction state. Desaturate them and
          block interaction so the user is forced through `rerun
          triage`. The header (with the rerun affordance) sits outside
          this container. */}
      <div
        style={{
          opacity: isStale ? 0.55 : 1,
          pointerEvents: isStale ? 'none' : 'auto',
          transition: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        aria-disabled={isStale || undefined}
      >
        <div style={{ marginTop: 14 }}>
          {CHECK_ORDER.map((id) => {
            const record = triage.checks.find((c) => c.id === id);
            return (
              <CheckRow
                key={id}
                checkId={id}
                record={record}
                readOnly={readOnly || isStale}
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
              isStale={isStale}
              verdictChanged={triage.lastVerdictChange}
            />
          )}
        </AnimatePresence>
      </div>
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

/**
 * Renders the autonomy state for the triage section: scheduled
 * countdown, fired-with-recall, or nothing. Reads from the autonomy
 * store keyed by entryRef.
 */
function AutonomyBanner({ entryRef }: { entryRef: string }) {
  const scheduled = useAutonomy((s) => s.scheduledByRef[entryRef]);
  const fired = useAutonomy((s) => s.firedByRef[entryRef]);
  const [recallOpen, setRecallOpen] = useState(false);
  const [, force] = useState(0);

  // Re-render once a second so the countdown advances.
  useEffect(() => {
    if (!scheduled && !fired) return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [scheduled, fired]);

  if (fired && !fired.recalled) {
    const expired = new Date(fired.recallExpiresAt).getTime() < Date.now();
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <AutonomyEyebrow
          classId={fired.classId}
          action={fired.action.toUpperCase()}
          firedAt={fired.firedAt}
          onOpen={() => setRecallOpen(true)}
        />
        {!expired && (
          <button
            type="button"
            onClick={() => setRecallOpen(true)}
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '3px 10px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-accent)',
              background: 'transparent',
              color: 'var(--color-accent)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            Recall this action →
          </button>
        )}
        {recallOpen && (
          <RecallModal
            entryRef={entryRef}
            classId={fired.classId}
            recallExpiresAt={fired.recallExpiresAt}
            onClose={() => setRecallOpen(false)}
            onRecalled={() => setRecallOpen(false)}
          />
        )}
      </div>
    );
  }

  if (fired && fired.recalled) {
    return (
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          marginBottom: 10,
          letterSpacing: '-0.005em',
        }}
      >
        Autonomous {fired.action} was recalled
        {fired.recalledAt
          ? ` at ${new Date(fired.recalledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
          : ''}{' '}
        — reverting to manual review.
      </div>
    );
  }

  if (scheduled) {
    const remaining = Math.max(
      0,
      Math.ceil((new Date(scheduled.firesAt).getTime() - Date.now()) / 1000),
    );
    const mm = String(Math.floor(remaining / 60)).padStart(1, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
          padding: '8px 10px',
          borderRadius: 'var(--radius-button)',
          border: '0.5px dashed var(--color-accent)',
          background: 'rgba(201, 99, 66, 0.04)',
        }}
      >
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink)',
            letterSpacing: '-0.005em',
          }}
        >
          Auto-pass scheduled in{' '}
          <span className="mono" style={{ letterSpacing: '0.04em', color: 'var(--color-accent)' }}>
            {mm}:{ss}
          </span>{' '}
          · class {scheduled.classId}
        </span>
        <button
          type="button"
          onClick={() => fireAutonomousAction({ entryRef })}
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            padding: '3px 10px',
            borderRadius: 'var(--radius-button)',
            border: '0.5px solid var(--color-accent)',
            background: 'var(--color-accent)',
            color: 'var(--color-bg)',
            cursor: 'pointer',
            letterSpacing: '-0.005em',
          }}
        >
          Review now → confirm immediately
        </button>
      </div>
    );
  }

  return null;
}
