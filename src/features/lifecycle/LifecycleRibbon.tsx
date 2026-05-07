import { useRanBerri } from '@/store';
import type { LifecycleMilestone } from '@/lib/fixtures';
import { daysUntilCritical } from '@/lib/fixtures/subjectivities';
import type { SubjectivityRecord } from '@/lib/bind/types';

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
 *
 * Seam labels live in their own row below everything, so they cannot
 * collide with phase headers.
 */
export function LifecycleRibbon({ compact = false }: Props = {}) {
  const cursor = useRanBerri((s) => s.lifecycle.cursor);
  const now = useRanBerri((s) => s.lifecycle.now);
  const scrub = useRanBerri((s) => s.scrubLifecycle);
  const bindPhase = useRanBerri((s) => s.bind.phase);
  const subjectivities = useRanBerri((s) => s.postBind.subjectivities);
  const policy = useRanBerri((s) => s.policy);

  const cursorSpec = MILESTONES.find((m) => m.key === cursor) ?? MILESTONES[0]!;
  const nowSpec = MILESTONES.find((m) => m.key === now) ?? MILESTONES[0]!;
  const playheadAtNow = cursor === now;
  const isBound = bindPhase === 'committed';
  const cancellation = useRanBerri((s) => s.cancellation);
  const isCancelled = cancellation.phase === 'committed' || cancellation.phase === 'sent';
  const renewal = useRanBerri((s) => s.renewal);
  const isRenewed = renewal.phase === 'committed' || renewal.phase === 'sent';
  // Hide Renewal once the policy is cancelled — there is no renewal
  // to forecast on a terminated policy. Hide Cancel once renewal has
  // succeeded — the year-1 policy never cancelled, it succeeded.
  const visibleMilestones = MILESTONES.filter((m) => {
    if (isCancelled && m.key === 'renewal') return false;
    if (isRenewed && m.key === 'cancel') return false;
    return true;
  });

  // MTA mini-markers between Bind (0.26) and MTA-04 (0.5). Each
  // committed endorsement gets a small filled coral dot at a fraction
  // of the (0.26 → 0.5) span.
  const mtaMiniMarkers = policy.versions.map((v, i) => {
    const fraction = (i + 1) / Math.max(1, policy.versions.length + 0.5);
    const at = 0.26 + fraction * (0.5 - 0.26);
    return { id: v.versionId, at, label: `MTA-0${v.endorsementNumber}` };
  });

  // Project active subjectivities with critical dates onto the ribbon.
  // A 365-day in-force window maps to the seam→cancel range
  // (0.18 → 0.74). For the demo, the Greenline Leeds permit at ~53
  // days lands ~0.26 into that span.
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
        {/* row A: phase labels */}
        {PHASES.map((p) => {
          const left = `${p.from * 100}%`;
          const width = `${(p.to - p.from) * 100}%`;
          return (
            <div
              key={p.label}
              className="absolute flex items-center justify-center"
              style={{
                left,
                width,
                top: yA,
                height: ROW_A,
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: phaseFontSize,
                color: 'var(--color-ink-mute)',
              }}
              aria-hidden
            >
              {p.label}
            </div>
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

        {/* phase tint band — barely visible thicker stripe under in-force */}
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

        {/* seam vertical hairlines spanning rows B–E */}
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

        {/* MTA mini-markers — small filled coral dots on the track,
            between Bind and MTA-04, one per committed endorsement. */}
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

        {/* subjectivity ticks — small gilt vertical marks rendered
            ABOVE the track so they read as forecast obligations,
            distinct from the milestone dots that sit on the track. */}
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
              // Sit fully above the track in the upper portion of row B,
              // clear of milestone dots that span trackY ± 4.5.
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

        {/* row B: milestone dots */}
        {visibleMilestones.map((m) => {
          const isCursor = m.key === cursor;
          const isNow = m.key === now;
          const dotBg = isNow
            ? 'var(--color-accent)'
            : isCursor
              ? 'var(--color-ink)'
              : 'var(--color-surface)';
          const dotBorder = isNow
            ? 'var(--color-accent)'
            : isCursor
              ? 'var(--color-ink)'
              : 'var(--color-rule-mid)';
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => scrub(m.key)}
              className="absolute"
              style={{
                left: `${m.at * 100}%`,
                top: trackY - 12,
                width: 24,
                height: 24,
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={`Scrub to ${m.label}`}
              aria-current={isCursor ? 'step' : undefined}
            >
              <span
                style={{
                  width: compact ? 8 : 9,
                  height: compact ? 8 : 9,
                  borderRadius: 999,
                  background: dotBg,
                  border: `0.5px solid ${dotBorder}`,
                  opacity: m.real || isCursor || isNow ? 1 : 0.6,
                }}
              />
            </button>
          );
        })}

        {/* row C: milestone names */}
        {visibleMilestones.map((m) => {
          const isCursor = m.key === cursor;
          return (
            <div
              key={`${m.key}-label`}
              className="absolute flex items-center justify-center"
              style={{
                left: `${m.at * 100}%`,
                top: yC,
                height: ROW_C,
                transform: 'translateX(-50%)',
                fontFamily: 'var(--font-sans)',
                fontSize: milestoneFontSize,
                fontWeight: isCursor ? 500 : 400,
                color: m.real ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {m.label}
            </div>
          );
        })}

        {/* row D: playhead arrow + italic "now" */}
        <div
          className="absolute flex flex-col items-center"
          style={{
            left: `${nowSpec.at * 100}%`,
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
        </div>

        {/* row E: seam labels */}
        {SEAMS.map((seam) => (
          <div
            key={seam.label}
            className="absolute"
            style={{
              left: `${seam.at * 100}%`,
              top: yE,
              height: ROW_E,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: seamFontSize,
              color: 'var(--color-ink-faint)',
              letterSpacing: '-0.005em',
              lineHeight: `${ROW_E}px`,
            }}
            aria-hidden
          >
            {seam.label}
          </div>
        ))}
      </div>
    </div>
  );
}
