import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRanBerri } from '@/store';
import type { LifecycleMilestone } from '@/lib/fixtures';
import { daysUntilCritical } from '@/lib/fixtures/subjectivities';
import type { SubjectivityRecord } from '@/lib/bind/types';
import { MilestoneTooltip } from './MilestoneTooltip';
import { PhaseLabelTooltip } from './PhaseLabelTooltip';
import { SeamLabelTooltip } from './SeamLabelTooltip';
import { milestoneDate } from './milestoneMeta';

type MilestoneSpec = {
  key: LifecycleMilestone;
  label: string;
  /** 0..1 along the track */
  at: number;
  real: boolean;
};

type PhaseSpec = {
  label: string;
  from: number;
  to: number;
};

type SeamSpec = {
  label: string;
  at: number;
};

const MILESTONES: MilestoneSpec[] = [
  { key: 'quote', label: 'Quote', at: 0.04, real: true },
  { key: 'quoted', label: 'Quoted', at: 0.14, real: true },
  { key: 'bind', label: 'Bind', at: 0.26, real: false },
  { key: 'mta-04', label: 'MTA-04', at: 0.5, real: false },
  { key: 'cancel', label: 'Cancel', at: 0.74, real: false },
  { key: 'renewal', label: 'Renewal', at: 0.96, real: false },
];

const PHASES: PhaseSpec[] = [
  { label: 'Pre-bind', from: 0, to: 0.18 },
  { label: 'In-force', from: 0.18, to: 0.82 },
  { label: 'Expired', from: 0.82, to: 1 },
];

const SEAMS: SeamSpec[] = [
  { label: 'submission becomes policy', at: 0.18 },
  { label: 'policy terminates', at: 0.82 },
  { label: 'policy succeeds (renewal)', at: 0.94 },
];

const HOVER_DELAY_MS = 200;

type Props = {
  /** Tighter geometry, suitable for embedding in a canvas header strip. */
  compact?: boolean;
};

/**
 * Pure ribbon visualisation. No outer card, no max-width column. The
 * caller decides chrome &mdash; the Pitch view wraps it in a card; the
 * Cockpit view embeds it as a header band.
 *
 * Vertical layout, top to bottom:
 *   row A — phase band      (italic serif phase labels)
 *   row B — track line      (dots + hairline)
 *   row C — milestone names (sans)
 *   row D — playhead arrow + "now" italic
 *   row E — seam labels     (italic serif faint)
 */
export function LifecycleRibbon({ compact = false }: Props = {}) {
  const cursor = useRanBerri((s) => s.lifecycle.cursor);
  const now = useRanBerri((s) => s.lifecycle.now);
  const scrub = useRanBerri((s) => s.scrubLifecycle);
  const bindPhase = useRanBerri((s) => s.bind.phase);
  const subjectivities = useRanBerri((s) => s.postBind.subjectivities);
  const policy = useRanBerri((s) => s.policy);
  const fullState = useRanBerri();

  const cursorSpec = MILESTONES.find((m) => m.key === cursor) ?? MILESTONES[0]!;
  const nowSpec = MILESTONES.find((m) => m.key === now) ?? MILESTONES[0]!;
  const playheadAtNow = cursor === now;
  const isBound = bindPhase === 'committed';
  const cancellation = useRanBerri((s) => s.cancellation);
  const isCancelled = cancellation.phase === 'committed' || cancellation.phase === 'sent';
  const renewal = useRanBerri((s) => s.renewal);
  const isRenewed = renewal.phase === 'committed' || renewal.phase === 'sent';
  const visibleMilestones = MILESTONES.filter((m) => {
    if (isCancelled && m.key === 'renewal') return false;
    if (isRenewed && m.key === 'cancel') return false;
    return true;
  });

  const mtaMiniMarkers = policy.versions.map((v, i) => {
    const fraction = (i + 1) / Math.max(1, policy.versions.length + 0.5);
    const at = 0.26 + fraction * (0.5 - 0.26);
    return { id: v.versionId, at, label: `MTA-0${v.endorsementNumber}` };
  });

  const subjectivityTicks = subjectivities
    .filter((s): s is SubjectivityRecord => s.criticalDate !== null && s.status === 'active')
    .map((s) => {
      const days = daysUntilCritical(s.criticalDate);
      if (days === null) return null;
      const fraction = Math.min(1, Math.max(0, days / 365));
      const at = 0.18 + fraction * (0.74 - 0.18);
      return { id: s.id, at, label: s.description };
    })
    .filter((t): t is { id: string; at: number; label: string } => t !== null);

  const ROW_A = compact ? 18 : 22;
  const ROW_B = compact ? 22 : 26;
  const ROW_C = compact ? 16 : 18;
  const ROW_D = compact ? 14 : 16;
  const ROW_E = compact ? 14 : 16;
  const total = ROW_A + ROW_B + ROW_C + ROW_D + ROW_E;

  const yA = 0;
  const yB = yA + ROW_A;
  const yC = yB + ROW_B;
  const yD = yC + ROW_C;
  const yE = yD + ROW_D;

  const trackY = yB + ROW_B / 2;

  const phaseFontSize = compact ? 11 : 12.5;
  const milestoneFontSize = compact ? 11 : 11.5;
  const nowFontSize = compact ? 10 : 10.5;
  const seamFontSize = compact ? 10 : 10.5;

  return (
    <div>
      {!compact && (
        <div className="mb-5 flex items-center justify-between">
          <div className="eyebrow">policy lifecycle</div>
          <div
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.06em',
            }}
          >
            cursor: {cursorSpec.label.toLowerCase()} ·{' '}
            {playheadAtNow ? 'now' : 'scrubbed'}
          </div>
        </div>
      )}

      <div className="relative" style={{ height: total }}>
        {/* row A: phase labels (with hover tooltips) */}
        {PHASES.map((p) => {
          const left = `${p.from * 100}%`;
          const width = `${(p.to - p.from) * 100}%`;
          return (
            <PhaseLabelArea
              key={p.label}
              label={p.label}
              left={left}
              width={width}
              top={yA}
              height={ROW_A}
              fontSize={phaseFontSize}
            />
          );
        })}

        {/* row B: track line */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: trackY,
            height: 0.5,
            background: 'var(--color-rule-mid)',
          }}
          aria-hidden
        />

        {/* phase tint band */}
        <div
          className="absolute"
          style={{
            left: `${PHASES[1]!.from * 100}%`,
            width: `${(PHASES[1]!.to - PHASES[1]!.from) * 100}%`,
            top: trackY - 0.5,
            height: 1.5,
            background: 'rgba(31, 30, 29, 0.10)',
          }}
          aria-hidden
        />

        {/* seam vertical hairlines */}
        {SEAMS.map((seam, i) => {
          const isBecomePolicySeam = i === 0;
          const isPolicyTerminatesSeam = i === 1;
          const isSuccessionSeam = i === 2;
          const isFilled =
            (isBecomePolicySeam && isBound) ||
            (isPolicyTerminatesSeam && isCancelled) ||
            (isSuccessionSeam && isRenewed);
          return (
            <div
              key={`${seam.label}-line`}
              className="absolute"
              style={{
                left: `${seam.at * 100}%`,
                top: yB,
                height: ROW_B + ROW_C + ROW_D + ROW_E,
                width: isFilled ? 1.5 : 0.5,
                background: isFilled
                  ? 'var(--color-accent)'
                  : 'var(--color-rule-mid)',
                transform: 'translateX(-50%)',
                transition: 'background 320ms cubic-bezier(0.4,0,0.2,1), width 320ms',
              }}
              aria-hidden
            />
          );
        })}

        {/* MTA mini-markers */}
        {mtaMiniMarkers.map((m) => (
          <span
            key={`mta-${m.id}`}
            title={m.label}
            aria-label={m.label}
            className="absolute"
            style={{
              left: `${m.at * 100}%`,
              top: trackY - 3,
              width: 6,
              height: 6,
              transform: 'translateX(-50%)',
              background: 'var(--color-accent)',
              borderRadius: 999,
              boxShadow: '0 0 0 0.5px var(--color-accent)',
            }}
            aria-hidden
          />
        ))}

        {/* subjectivity ticks */}
        {subjectivityTicks.map((tick) => (
          <button
            key={`tick-${tick.id}`}
            type="button"
            onClick={() => useRanBerri.getState().setInspectingSubjectivity(tick.id)}
            title={tick.label}
            aria-label={`Subjectivity ${tick.id}`}
            className="absolute"
            style={{
              left: `${tick.at * 100}%`,
              top: trackY - 18,
              width: 14,
              height: 14,
              transform: 'translateX(-50%)',
              padding: 0,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                display: 'block',
                width: 1.5,
                height: 10,
                background: 'var(--color-accent)',
                opacity: 0.85,
              }}
            />
          </button>
        ))}

        {/* milestone areas (dot + label + hover/click affordances) */}
        {visibleMilestones.map((m) => (
          <MilestoneArea
            key={m.key}
            milestone={m}
            cursor={cursor}
            now={now}
            trackY={trackY}
            yC={yC}
            rowC={ROW_C}
            compact={compact}
            milestoneFontSize={milestoneFontSize}
            date={milestoneDate(m.key, fullState)}
            onScrub={() => scrub(m.key)}
          />
        ))}

        {/* row D: playhead arrow + italic "now" — slides smoothly */}
        <motion.div
          className="absolute flex flex-col items-center"
          animate={{ left: `${nowSpec.at * 100}%` }}
          transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
          style={{
            top: yD,
            height: ROW_D,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
          aria-hidden
        >
          <svg width="9" height="5" viewBox="0 0 9 5" style={{ marginTop: -1 }}>
            <path
              d="M4.5 0 L0 5 L9 5 Z"
              fill={playheadAtNow ? 'var(--color-accent)' : 'var(--color-ink-faint)'}
            />
          </svg>
          <span
            style={{
              marginTop: 1,
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: nowFontSize,
              color: playheadAtNow ? 'var(--color-accent)' : 'var(--color-ink-faint)',
              letterSpacing: '-0.005em',
            }}
          >
            now
          </span>
        </motion.div>

        {/* row E: seam labels (with hover tooltips) */}
        {SEAMS.map((seam) => (
          <SeamLabelArea
            key={seam.label}
            label={seam.label}
            at={seam.at}
            top={yE}
            height={ROW_E}
            fontSize={seamFontSize}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One milestone unit: dot + label + click button + hover tooltip +
 * click-pulse animation + active styling. Owned-state for hover and
 * the 240ms pulse + 400ms ring.
 */
function MilestoneArea({
  milestone,
  cursor,
  now,
  trackY,
  yC,
  rowC,
  compact,
  milestoneFontSize,
  date,
  onScrub,
}: {
  milestone: MilestoneSpec;
  cursor: LifecycleMilestone;
  now: LifecycleMilestone;
  trackY: number;
  yC: number;
  rowC: number;
  compact: boolean;
  milestoneFontSize: number;
  date: string | null;
  onScrub: () => void;
}) {
  const isCursor = milestone.key === cursor;
  const isNow = milestone.key === now;
  const [hovered, setHovered] = useState(false);
  const [tooltipShown, setTooltipShown] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [ringKey, setRingKey] = useState(0);
  const hoverTimerRef = useRef<number | null>(null);
  const pulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hovered) {
      hoverTimerRef.current = window.setTimeout(
        () => setTooltipShown(true),
        HOVER_DELAY_MS,
      );
    } else {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      setTooltipShown(false);
    }
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, [hovered]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null) {
        window.clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  function onClick() {
    setPulsing(true);
    setRingKey((k) => k + 1);
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
    }
    pulseTimerRef.current = window.setTimeout(() => setPulsing(false), 240);
    onScrub();
  }

  // Active milestone styling: filled coral dot when actively viewed
  // (cursor OR now). Background ring + hairline border under the
  // label for the cursor (the actively viewed state).
  const dotBg = isNow
    ? 'var(--color-accent)'
    : isCursor
      ? 'var(--color-accent)'
      : hovered
        ? 'var(--color-bg)'
        : 'var(--color-surface)';
  const dotBorder = isNow || isCursor
    ? 'var(--color-accent)'
    : hovered
      ? 'var(--color-accent)'
      : 'var(--color-rule-mid)';

  const labelColor = isCursor || hovered
    ? 'var(--color-accent)'
    : milestone.real
      ? 'var(--color-ink)'
      : 'var(--color-ink-faint)';
  const labelWeight = isCursor || hovered ? 500 : milestone.real ? 400 : 400;
  const labelStyle: React.CSSProperties = hovered || isCursor
    ? { fontStyle: 'italic' }
    : {};

  // Active ring around the cursor's label area + subtle elevation
  const activeRing = isCursor;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${milestone.at * 100}%`,
        top: trackY - 12,
        transform: 'translateX(-50%)',
        height: yC + rowC - (trackY - 12),
        width: 88,
        marginLeft: -44,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* tooltip */}
      <MilestoneTooltip
        visible={tooltipShown}
        milestone={milestone.key}
        now={now}
        date={date}
      />

      {/* clickable dot button */}
      <button
        type="button"
        onClick={onClick}
        aria-label={`Scrub to ${milestone.label}`}
        aria-current={isCursor ? 'step' : undefined}
        style={{
          width: 24,
          height: 24,
          padding: 0,
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <motion.span
          animate={{ scale: pulsing ? [1, 1.25, 1] : hovered ? 1.15 : 1 }}
          transition={
            pulsing
              ? { duration: 0.24, ease: [0.4, 0, 0.2, 1] }
              : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
          }
          style={{
            width: compact ? 8 : 9,
            height: compact ? 8 : 9,
            borderRadius: 999,
            background: dotBg,
            border: `0.5px solid ${dotBorder}`,
            opacity: milestone.real || isCursor || isNow ? 1 : 0.7,
            display: 'block',
          }}
        />

        {/* expanding ring on click — keyed so each click re-mounts */}
        <AnimatePresence>
          <motion.span
            key={ringKey}
            initial={{ opacity: 0.6, width: 8, height: 8 }}
            animate={{ opacity: 0, width: 24, height: 24 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: 999,
              border: '1px solid var(--color-accent)',
              pointerEvents: 'none',
            }}
            aria-hidden
          />
        </AnimatePresence>
      </button>

      {/* label area — wrapped so border-bottom can sit underneath */}
      <div
        style={{
          marginTop: 1,
          height: rowC,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '0 6px',
          borderRadius: 'var(--radius-button)',
          border: activeRing
            ? '0.5px solid var(--color-accent)'
            : '0.5px solid transparent',
          background: activeRing ? 'rgba(201, 99, 66, 0.04)' : 'transparent',
          boxShadow: activeRing
            ? '0 1px 2px rgba(31, 30, 29, 0.04)'
            : 'none',
          transition:
            'border-color 200ms cubic-bezier(0.4,0,0.2,1), background 200ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: milestoneFontSize,
            fontWeight: labelWeight,
            color: labelColor,
            whiteSpace: 'nowrap',
            transition:
              'color 200ms cubic-bezier(0.4,0,0.2,1), font-weight 200ms',
            ...labelStyle,
          }}
        >
          {milestone.label}
        </span>
        {/* hover hairline coral underline */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 6,
            right: 6,
            bottom: 1,
            height: 0.5,
            background:
              hovered && !activeRing ? 'var(--color-accent)' : 'transparent',
            transition: 'background 100ms ease-out',
          }}
        />
      </div>
    </div>
  );
}

function PhaseLabelArea({
  label,
  left,
  width,
  top,
  height,
  fontSize,
}: {
  label: string;
  left: string;
  width: string;
  top: number;
  height: number;
  fontSize: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [tooltipShown, setTooltipShown] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hovered) {
      timerRef.current = window.setTimeout(
        () => setTooltipShown(true),
        HOVER_DELAY_MS,
      );
    } else {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      setTooltipShown(false);
    }
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [hovered]);

  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        left,
        width,
        top,
        height,
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize,
        color: hovered ? 'var(--color-ink-soft)' : 'var(--color-ink-mute)',
        position: 'absolute',
        cursor: 'help',
        transition: 'color 200ms ease-out',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ position: 'relative' }}>
        {label}
        <PhaseLabelTooltip visible={tooltipShown} label={label} />
      </span>
    </div>
  );
}

function SeamLabelArea({
  label,
  at,
  top,
  height,
  fontSize,
}: {
  label: string;
  at: number;
  top: number;
  height: number;
  fontSize: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [tooltipShown, setTooltipShown] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hovered) {
      timerRef.current = window.setTimeout(
        () => setTooltipShown(true),
        HOVER_DELAY_MS,
      );
    } else {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      setTooltipShown(false);
    }
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [hovered]);

  return (
    <div
      className="absolute"
      style={{
        left: `${at * 100}%`,
        top,
        height,
        transform: 'translateX(-50%)',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize,
        color: hovered ? 'var(--color-ink-mute)' : 'var(--color-ink-faint)',
        letterSpacing: '-0.005em',
        lineHeight: `${height}px`,
        cursor: 'help',
        transition: 'color 200ms ease-out',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ position: 'relative' }}>
        {label}
        <SeamLabelTooltip visible={tooltipShown} label={label} />
      </span>
    </div>
  );
}
