import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useCanvasUI } from '@/store/canvasUI';

const AUTO_DISMISS_MS = 8000;

/**
 * Subtle introductory cue for the lifecycle ribbon. Shown once per
 * session (persisted via canvasUI.firstRibbonEncounter) directly
 * below the ribbon, with an upward-pointing arrow. Auto-dismisses
 * after 8 seconds OR when the user clicks ×.
 */
export function RibbonFirstEncounterCue() {
  const firstEncounter = useCanvasUI((s) => s.firstRibbonEncounter);
  const dismiss = useCanvasUI((s) => s.dismissRibbonFirstEncounter);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!firstEncounter) return;
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      dismiss();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [firstEncounter, dismiss]);

  function onClose() {
    setVisible(false);
    dismiss();
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'relative',
            margin: '8px 28px 0',
            padding: '8px 12px 8px 14px',
            background: '#FBF7EF',
            borderLeft: '2px solid var(--color-accent)',
            borderRadius: 'var(--radius-button)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            maxWidth: 480,
          }}
        >
          {/* Upward arrow pointing at the ribbon */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 24,
              top: -5,
              width: 8,
              height: 8,
              transform: 'rotate(45deg)',
              background: '#FBF7EF',
              borderTop: '0.5px solid var(--color-rule-mid)',
              borderLeft: '0.5px solid var(--color-rule-mid)',
            }}
          />
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--color-ink-soft)',
              letterSpacing: '-0.005em',
              flex: 1,
              lineHeight: 1.5,
            }}
          >
            Click any milestone to view the policy at that point in time.
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            style={{
              padding: 2,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: 'var(--color-ink-faint)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = 'var(--color-accent)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = 'var(--color-ink-faint)')
            }
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
