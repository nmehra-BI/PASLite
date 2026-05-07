import { Zap } from 'lucide-react';

/**
 * Module 14 — visual treatment for canvas sections rendered by
 * autonomous action.
 *
 * Renders a small eyebrow at the top of an autonomous section:
 *   ⚡ AUTONOMOUS · TRIAGE-AUTO-PASS · acted at 09:14
 * Wrap the section body in a div with `borderLeft: 1px solid coral`
 * for the colour cue. Clicking the eyebrow opens the AutonomyInspector
 * for that ref.
 */
export function AutonomyEyebrow({
  classId,
  action,
  firedAt,
  onOpen,
}: {
  classId: string;
  action: string;
  firedAt: string;
  onOpen: () => void;
}) {
  const t = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(firedAt));

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mono inline-flex items-center gap-1.5"
      style={{
        fontSize: 9.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--color-accent)',
        background: 'transparent',
        border: 0,
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <Zap size={11} strokeWidth={1.5} />
      AUTONOMOUS · {classId} · {action} at {t}
    </button>
  );
}
