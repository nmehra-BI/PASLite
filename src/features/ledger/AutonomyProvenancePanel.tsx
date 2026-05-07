import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, X } from 'lucide-react';
import { useRanBerri } from '@/store';
import { autonomyActionsForPolicy } from '@/lib/ledger';
import { AutonomyProvenanceRow } from './AutonomyProvenanceRow';

/**
 * Module 15 — per-policy autonomy provenance panel. Reads the live
 * audit log + the ledger fixture, filtered to this policy's ref.
 * Hidden entirely when the policy has had no autonomous actions
 * (don't show "0 actions" — just don't render).
 */
export function AutonomyProvenancePanel() {
  const submission = useRanBerri((s) => s.submission);
  const bind = useRanBerri((s) => s.bind);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Use whichever ref is the canonical identifier for "this policy".
  // Prefer the bind policyRef (POL-X) when bound; fall back to the
  // submission id otherwise.
  const policyRef = bind.policyRef ?? submission?.id ?? null;

  const actions = useMemo(
    () => (policyRef ? autonomyActionsForPolicy(policyRef) : []),
    [policyRef],
  );

  if (!policyRef || actions.length === 0) return null;

  const latest = [...actions]
    .sort((a, b) => b.firedAt.localeCompare(a.firedAt))
    .slice(0, 3);

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
        style={{
          margin: '14px 28px 0',
          padding: '14px 16px',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-bg)',
          borderLeft: '2px solid var(--color-accent)',
          border: '0.5px solid var(--color-rule-mid)',
        }}
      >
        <div className="flex items-baseline justify-between" style={{ gap: 12 }}>
          <div>
            <div className="eyebrow">autonomy provenance</div>
            <div
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 13,
                color: 'var(--color-ink-mute)',
                marginTop: 2,
                letterSpacing: '-0.005em',
              }}
            >
              the AI&rsquo;s actions on this policy
            </div>
          </div>
          {actions.length > 3 && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="serif inline-flex items-center gap-1"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                padding: '4px 10px',
                borderRadius: 'var(--radius-button)',
                border: '0.5px solid var(--color-rule-mid)',
                background: 'transparent',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                letterSpacing: '-0.005em',
              }}
            >
              View all {actions.length}
              <ArrowUpRight size={11} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {latest.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.08 }}
            >
              <AutonomyProvenanceRow action={a} />
            </motion.div>
          ))}
        </div>
      </motion.section>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(31, 30, 29, 0.18)',
              zIndex: 60,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'flex-end',
            }}
          >
            <motion.aside
              initial={{ x: 16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 16, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="hairline-l"
              style={{
                width: 480,
                maxWidth: '100vw',
                background: 'var(--color-surface)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <div
                className="hairline-b flex items-baseline justify-between"
                style={{ padding: '14px 22px', flex: '0 0 auto' }}
              >
                <div>
                  <div className="eyebrow">autonomy provenance · full</div>
                  <div
                    className="serif"
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: 'var(--color-ink)',
                      letterSpacing: '-0.012em',
                      marginTop: 2,
                    }}
                  >
                    {policyRef}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close"
                  style={{
                    padding: 4,
                    color: 'var(--color-ink-mute)',
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} strokeWidth={1.5} />
                </button>
              </div>
              <div
                style={{
                  padding: '14px 22px',
                  flex: 1,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {actions.map((a) => (
                  <AutonomyProvenanceRow key={a.id} action={a} />
                ))}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
