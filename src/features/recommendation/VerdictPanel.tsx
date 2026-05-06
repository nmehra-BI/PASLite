import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import { ReferralModal } from '@/features/triage/ReferralModal';
import type { RecommendationFactorRecord } from '@/store/replay';

type Verdict = 'bind' | 'refer' | 'ntu';

type Props = {
  verdict: Verdict;
  confidence: 'high' | 'moderate' | 'low';
  factors: RecommendationFactorRecord[];
  readOnly: boolean;
  /** Verdict changed notice ("BIND → REFER · cause"). */
  verdictChanged: { from: Verdict; to: Verdict } | null;
  onOpenDeepDive: () => void;
};

const PRIMARY_BY_VERDICT: Record<Verdict, 'bind' | 'refer' | 'ntu'> = {
  bind: 'bind',
  refer: 'refer',
  ntu: 'ntu',
};

const VERDICT_TONE: Record<Verdict, string> = {
  bind: 'var(--color-success)',
  refer: 'var(--color-warn)',
  ntu: 'var(--color-danger)',
};

export function VerdictPanel({
  verdict,
  confidence,
  factors,
  readOnly,
  verdictChanged,
  onOpenDeepDive,
}: Props) {
  const actOn = useRanBerri((s) => s.actOnRecommendation);
  const [referOpen, setReferOpen] = useState(false);
  const primary = PRIMARY_BY_VERDICT[verdict];

  const proBindCount = factors.filter((f) => f.vote === 'pro-bind').length;
  const neutralCount = factors.filter((f) => f.vote === 'neutral').length;
  const proReferCount = factors.filter((f) => f.vote === 'pro-refer').length;
  const proNtuCount = factors.filter((f) => f.vote === 'pro-ntu').length;

  const summary = (() => {
    if (verdict === 'bind') {
      return `${proBindCount} of ${factors.length} factors pro-bind${neutralCount > 0 ? `, ${neutralCount} neutral` : ''}`;
    }
    if (verdict === 'refer') {
      return `${proReferCount + neutralCount} of ${factors.length} factors flag refer or neutral`;
    }
    return `${proNtuCount} of ${factors.length} factors pro-NTU`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
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
          Recommendation changed: {verdictChanged.from.toUpperCase()} → {verdictChanged.to.toUpperCase()}
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
          color: VERDICT_TONE[verdict],
          letterSpacing: '-0.005em',
        }}
      >
        {verdict.toUpperCase()} · {confidence} confidence
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          marginTop: 2,
        }}
      >
        {summary}
      </div>

      <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
        <ActionButton
          label="Bind →"
          tone={primary === 'bind' ? 'primary' : 'secondary'}
          disabled={readOnly}
          onClick={() => actOn({ action: 'bind', actedBy: 'nm' })}
        />
        <ActionButton
          label="Refer to senior"
          tone={primary === 'refer' ? 'primary' : 'secondary'}
          disabled={readOnly}
          onClick={() => setReferOpen(true)}
        />
        <ActionButton
          label="NTU · walk away"
          tone={primary === 'ntu' ? 'primary' : 'ghost'}
          disabled={readOnly}
          onClick={() => actOn({ action: 'ntu', actedBy: 'nm' })}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={onOpenDeepDive}
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-accent)',
            padding: 0,
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textDecorationColor: 'var(--color-accent)',
            textUnderlineOffset: 3,
          }}
        >
          Why this recommendation?
        </button>
      </div>

      {referOpen && (
        <ReferralModal
          onBeforeSubmit={() => {
            // Record the underwriter's intent against the recommendation
            // before the modal advances state to 'referred'. Cancelling
            // the modal never reaches this branch.
            actOn({ action: 'refer', actedBy: 'nm' });
          }}
          onClose={() => setReferOpen(false)}
        />
      )}
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
  // The asymmetric design: when this button is the recommended primary,
  // it gets a one-shot scale-in animation. Subtle but signals "this is
  // what the cockpit recommends".
  return (
    <motion.div
      initial={tone === 'primary' ? { scale: 0.96, opacity: 0 } : false}
      animate={tone === 'primary' ? { scale: 1, opacity: 1 } : { opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <Button variant={tone} size="md" disabled={disabled} onClick={onClick}>
        {label}
      </Button>
    </motion.div>
  );
}
