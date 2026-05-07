import { RibbonTooltip } from './RibbonTooltip';

const COPY: Record<string, string> = {
  'Pre-bind':
    'Pre-bind phase · submission, extraction, triage, rating, quote, recommendation. Ends when bind hashes are signed.',
  'In-force': 'In-force phase · policy is bound, monitored, and may be endorsed (MTA).',
  Expired: 'Expired phase · policy term has ended via cancellation, NTU, or natural expiry.',
};

/**
 * Phase-label hover tooltip. Phase labels are not click-navigable
 * (only milestones are) but they get hover affordances for context.
 */
export function PhaseLabelTooltip({
  visible,
  label,
}: {
  visible: boolean;
  label: string;
}) {
  const text = COPY[label] ?? label;
  return (
    <RibbonTooltip visible={visible}>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </RibbonTooltip>
  );
}
