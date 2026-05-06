import { motion, AnimatePresence } from 'framer-motion';
import { useRanBerri } from '@/store';

/**
 * The choreographed seam fire animation. Renders only while
 * ui.seamFiring is true. The orchestrating component sets it true
 * just before commitBind() and clears it ~1100ms later.
 *
 * The animation is intentionally restrained: a coral hairline scales
 * across the canvas's vertical center, glows briefly, and fades.
 * Layered text/header/ribbon transitions are owned by their
 * respective components watching `bind.phase === 'committed'`.
 */
export function SeamAnimation() {
  const firing = useRanBerri((s) => s.ui.seamFiring);
  return (
    <AnimatePresence>
      {firing && (
        <motion.div
          key="seam"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{
              scaleX: [0, 1, 1, 1],
              opacity: [0, 1, 0.7, 0],
            }}
            transition={{
              duration: 1.0,
              times: [0, 0.45, 0.7, 1],
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{
              transformOrigin: 'center',
              width: '100%',
              height: 1.5,
              background: 'var(--color-accent)',
              filter: 'drop-shadow(0 0 8px var(--color-accent))',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
