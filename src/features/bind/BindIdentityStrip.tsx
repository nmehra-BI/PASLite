import { motion, AnimatePresence } from 'framer-motion';
import { useRanBerri } from '@/store';
import { Pill } from '@/components';

/**
 * The submission/policy identity strip. Renders during the bind
 * ceremony AND post-bind so the underwriter can watch
 * `SUB-29481 → POL-29481` cross over. Strikethrough draws on the SUB
 * id mid-seam-fire; POL fades in beside it.
 *
 * Conditions:
 *   - submission active and bind ceremony has started → render strip
 *   - bind.phase 'in-progress' → show SUB id, status pill 'BIND PENDING'
 *   - bind.phase 'committed'   → show POL id, status pill 'BOUND · IN FORCE'
 */
export function BindIdentityStrip() {
  const submission = useRanBerri((s) => s.submission);
  const bindPhase = useRanBerri((s) => s.bind.phase);
  const policyRef = useRanBerri((s) => s.bind.policyRef);
  const folio = submission?.folio ?? '';

  if (!submission || (bindPhase !== 'in-progress' && bindPhase !== 'committed')) {
    return null;
  }

  // Derive a clean SUB-29481 from the folio "MGA-PAS · folio 29481".
  const folioNum = folio.match(/folio\s+(\d+)/i)?.[1];
  const subRef = folioNum ? `SUB-${folioNum}` : submission.id;
  const polRef = policyRef ?? (folioNum ? `POL-${folioNum}` : null);
  const isBound = bindPhase === 'committed';

  return (
    <div
      className="hairline-b"
      style={{
        background: 'var(--color-surface)',
        padding: '10px 22px',
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
        <div
          className="serif"
          style={{
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: '-0.012em',
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          {/* SUB id with strikethrough that draws on commit. */}
          <span
            style={{
              position: 'relative',
              color: isBound ? 'var(--color-ink-faint)' : 'var(--color-ink)',
              transition: 'color 320ms cubic-bezier(0.4,0,0.2,1) 200ms',
            }}
          >
            {subRef}
            <motion.span
              aria-hidden
              initial={false}
              animate={{ scaleX: isBound ? 1 : 0 }}
              transition={{
                duration: 0.22,
                ease: [0.4, 0, 0.2, 1],
                delay: isBound ? 0.18 : 0,
              }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '52%',
                height: 1,
                background: 'var(--color-accent)',
                transformOrigin: 'left center',
              }}
            />
          </span>

          <AnimatePresence>
            {isBound && polRef && (
              <motion.span
                key="arrow"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.36 }}
                style={{
                  fontStyle: 'italic',
                  color: 'var(--color-accent)',
                  fontSize: 14,
                }}
              >
                →
              </motion.span>
            )}
            {isBound && polRef && (
              <motion.span
                key="pol"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, delay: 0.42 }}
                style={{ color: 'var(--color-ink)' }}
              >
                {polRef}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            letterSpacing: '-0.005em',
          }}
        >
          {isBound ? 'in force · 12 months' : 'four hashes pending'}
        </span>
      </div>

      <Pill tone={isBound ? 'success' : 'warn'} mono>
        {isBound ? 'BOUND · IN FORCE' : 'BIND PENDING'}
      </Pill>
    </div>
  );
}
