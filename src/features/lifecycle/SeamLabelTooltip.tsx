import { RibbonTooltip } from './RibbonTooltip';

const COPY: Record<string, string> = {
  'submission becomes policy':
    'The moment the submission becomes a bound policy. Pre-bind workflow ends here; the policy term begins.',
  'policy terminates':
    'The moment the policy terminates — cancellation committed, NTU recorded, or term expires.',
  'policy succeeds (renewal)':
    'The moment year-1 succeeds into year-2. The successor policy is the new in-force record; year-1 archives to history.',
};

/**
 * Seam-label hover tooltip. Like phase labels, seam labels aren't
 * click-navigable on their own — they get hover affordances so
 * first-time users can read what each boundary represents.
 */
export function SeamLabelTooltip({
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
