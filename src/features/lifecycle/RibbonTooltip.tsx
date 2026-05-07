import { motion, AnimatePresence } from 'framer-motion';

/**
 * Shared visual chrome for ribbon hover tooltips. Cream paper bg,
 * hairline border, italic serif body, max 240px wide, with a small
 * downward arrow pointing at the target. Render conditionally;
 * AnimatePresence drives the 200ms fade.
 */
export function RibbonTooltip({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          role="tooltip"
          className="hairline"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 'calc(100% + 8px)',
            transform: 'translateX(-50%)',
            padding: '8px 12px',
            background: '#FBF7EF',
            borderColor: 'var(--color-rule-mid)',
            borderRadius: 'var(--radius-card)',
            maxWidth: 240,
            zIndex: 30,
            pointerEvents: 'none',
            boxShadow: '0 1px 2px rgba(31, 30, 29, 0.06)',
          }}
        >
          {children}
          {/* Downward arrow */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: '100%',
              transform: 'translate(-50%, -1px) rotate(45deg)',
              width: 7,
              height: 7,
              background: '#FBF7EF',
              borderRight: '0.5px solid var(--color-rule-mid)',
              borderBottom: '0.5px solid var(--color-rule-mid)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
