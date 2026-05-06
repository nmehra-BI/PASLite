import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import type { TriageCheckRecord, TriageOutcome } from '@/store/replay';
import { ReferralModal } from './ReferralModal';
import { DeclineModal } from './DeclineModal';

type Props = {
  checks: TriageCheckRecord[];
  verdict: TriageOutcome;
  readOnly: boolean;
  /** True when the triage artifact is stale (an upstream change happened). */
  isStale?: boolean;
  /** "PASS → REFER" notice, rendered when an override or rerun changed the verdict. */
  verdictChanged: { from: TriageOutcome; to: TriageOutcome; cause: string } | null;
};

const PRIMARY_BY_VERDICT: Record<TriageOutcome, 'proceed' | 'refer' | 'decline'> = {
  pass: 'proceed',
  refer: 'refer',
  decline: 'decline',
};

export function VerdictPanel({
  checks,
  verdict,
  readOnly,
  isStale = false,
  verdictChanged,
}: Props) {
  const proceed = useRanBerri((s) => s.proceedToRating);
  const [referOpen, setReferOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  const passCount = checks.filter(
    (c) => (c.override?.outcome ?? c.outcome) === 'pass',
  ).length;
  const overriddenCount = checks.filter((c) => c.override !== null).length;

  const headline = buildHeadline(verdict, passCount, checks.length, overriddenCount);

  const headlineColor =
    verdict === 'pass'
      ? 'var(--color-success)'
      : verdict === 'refer'
        ? 'var(--color-warn)'
        : 'var(--color-danger)';

  const primary = PRIMARY_BY_VERDICT[verdict];
  // Proceed is disabled when the verdict isn't pass, when the triage
  // artifact is stale (verdict reflects pre-correction state), or when
  // the submission is read-only.
  const proceedDisabled = verdict !== 'pass' || readOnly || isStale;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
      style={{ marginTop: 22 }}
    >
      {verdictChanged && (
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-accent)',
            marginBottom: 10,
            letterSpacing: '-0.005em',
          }}
        >
          Verdict changed: {verdictChanged.from.toUpperCase()} →{' '}
          {verdictChanged.to.toUpperCase()} · {verdictChanged.cause}
        </div>
      )}

      <div className="eyebrow" style={{ marginBottom: 4 }}>
        verdict
      </div>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 18,
          fontWeight: 500,
          color: headlineColor,
          letterSpacing: '-0.005em',
        }}
      >
        {headline}
      </div>

      <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
        <ActionButton
          label="Proceed to rating →"
          tone={primary === 'proceed' ? 'primary' : 'secondary'}
          disabled={proceedDisabled}
          onClick={() => proceed()}
        />
        <ActionButton
          label="Refer to senior"
          tone={primary === 'refer' ? 'primary' : 'secondary'}
          disabled={readOnly}
          onClick={() => setReferOpen(true)}
        />
        <ActionButton
          label="Decline"
          tone={primary === 'decline' ? 'primary' : 'ghost'}
          disabled={readOnly}
          onClick={() => setDeclineOpen(true)}
        />
      </div>

      {referOpen && <ReferralModal onClose={() => setReferOpen(false)} />}
      {declineOpen && <DeclineModal onClose={() => setDeclineOpen(false)} />}
    </motion.div>
  );
}

function ActionButton({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone: 'primary' | 'secondary' | 'ghost';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={tone}
      size="md"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

/**
 * Headline composition. Override count is surfaced in every verdict
 * branch (not just pass) so the override is always visible in the
 * summary line.
 */
function buildHeadline(
  verdict: TriageOutcome,
  passCount: number,
  total: number,
  overriddenCount: number,
): string {
  const tag = overriddenCount > 0 ? ` · ${overriddenCount} overridden` : '';
  if (verdict === 'pass') {
    return overriddenCount > 0
      ? `${overriddenCount} OVERRIDDEN · ${passCount} of ${total} pass`
      : `ALL CHECKS PASSED · ${passCount} of ${total}`;
  }
  if (verdict === 'refer') {
    return `REFER · ${passCount} of ${total} pass${tag}`;
  }
  return `DECLINE · ${passCount} of ${total} pass${tag}`;
}
