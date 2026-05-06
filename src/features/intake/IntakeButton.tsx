import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import { runExtraction } from './extraction-engine';
import { useIntake } from './intakeStore';

/**
 * The single entry point: a primary button on the empty canvas that
 * triggers the cinematic extraction. Kept deliberately quiet
 * &mdash; the cinematic itself does the talking.
 */
export function IntakeButton() {
  const phase = useIntake((s) => s.phase);
  const visible = phase === 'idle';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -4 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 28px',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div className="eyebrow mb-4">no submission active</div>
      <button
        type="button"
        onClick={() => {
          if (phase !== 'idle') return;
          void runExtraction();
        }}
        className="inline-flex items-center gap-2"
        style={{
          padding: '10px 18px',
          background: 'var(--color-accent)',
          color: 'var(--color-bg)',
          fontFamily: 'var(--font-sans)',
          fontSize: 13.5,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          borderRadius: 'var(--radius-button)',
          transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Mail size={14} strokeWidth={1.75} />
        Receive new submission
      </button>
      <p
        className="serif"
        style={{
          marginTop: 10,
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
        }}
      >
        from SureStep · queued
      </p>
    </motion.div>
  );
}
