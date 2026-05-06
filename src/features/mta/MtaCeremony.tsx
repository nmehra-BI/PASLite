import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useRanBerri } from '@/store';
import { commitMta, confirmMtaHash } from '@/lib/mta';
import type { MtaHashId } from '@/lib/mta';

const HASHES: Array<{
  id: MtaHashId;
  index: number;
  title: string;
  primaryFor: (state: ReturnType<typeof readPanelState>) => string;
  citationFor: (state: ReturnType<typeof readPanelState>) => string;
}> = [
  {
    id: 'delta-premium',
    index: 1,
    title: 'Delta premium',
    primaryFor: (s) =>
      s.delta
        ? `AP £${s.delta.proRatedAP.toLocaleString('en-GB')} confirmed against rating engine v3.2`
        : 'AP confirmed against rating engine v3.2',
    citationFor: (s) =>
      s.delta
        ? `${s.delta.sha} · pro-rata ${s.delta.daysRemaining}/${s.delta.daysInTerm} sealed`
        : 'pro-rata sealed',
  },
  {
    id: 'capacity-update',
    index: 2,
    title: 'Capacity update',
    primaryFor: (s) =>
      s.capacity
        ? `Syndicate 2358 · 65% line maintained · £${s.capacity.newTotalConsumption.toLocaleString('en-GB')} total`
        : 'Syndicate 2358 · 65% line maintained',
    citationFor: (s) =>
      s.capacity
        ? `delta consumption £${s.capacity.deltaConsumption.toLocaleString('en-GB')} · within syndicate headroom`
        : 'capacity check pending',
  },
];

function readPanelState() {
  return useRanBerri.getState().mta;
}

/**
 * The two-hash MTA ceremony — same UI pattern as the bind ceremony,
 * scaled down. Both hashes are signable; "Issue endorsement" arms
 * once both are signed.
 */
export function MtaCeremony({
  onIssue,
  committing,
}: {
  onIssue: () => void;
  committing: boolean;
}) {
  const mta = useRanBerri((s) => s.mta);

  if (!mta.request) return null;
  if (
    mta.phase !== 'schedule-ready' &&
    mta.phase !== 'ceremony-in-progress'
  ) {
    return null;
  }

  const confirmedCount = mta.hashes.filter(
    (h) => h.status === 'confirmed' || h.status === 'overridden',
  ).length;
  const allTwo = confirmedCount === 2;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      className="hairline-t"
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">endorsement ceremony</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14.5,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          two hashes · scaled-down sign-off
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {HASHES.map((h) => {
          const record = mta.hashes.find((x) => x.id === h.id);
          const state = readPanelState();
          return (
            <Row
              key={h.id}
              hashId={h.id}
              index={h.index}
              title={h.title}
              primary={h.primaryFor(state)}
              citation={h.citationFor(state)}
              signed={record?.status === 'confirmed' || record?.status === 'overridden'}
            />
          );
        })}
      </div>

      <div
        className="hairline-t"
        style={{
          marginTop: 18,
          paddingTop: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: allTwo ? 'var(--color-success)' : 'var(--color-ink-mute)',
            letterSpacing: '-0.005em',
          }}
        >
          {confirmedCount} of 2 confirmed{allTwo ? ' · ready to issue' : ''}
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            initial={false}
            animate={allTwo ? { scale: [0.96, 1] } : { scale: 1 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <button
              type="button"
              onClick={onIssue}
              disabled={!allTwo || committing}
              className="inline-flex items-center"
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-button)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12.5,
                fontWeight: 500,
                color: allTwo ? 'var(--color-bg)' : 'var(--color-ink-faint)',
                background: allTwo ? 'var(--color-accent)' : 'var(--color-sunken)',
                border: `0.5px solid ${
                  allTwo ? 'var(--color-accent)' : 'var(--color-rule-mid)'
                }`,
                cursor: allTwo ? 'pointer' : 'not-allowed',
                transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              Issue endorsement →
            </button>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

function Row({
  hashId,
  index,
  title,
  primary,
  citation,
  signed,
}: {
  hashId: MtaHashId;
  index: number;
  title: string;
  primary: string;
  citation: string;
  signed: boolean;
}) {
  const [pulsing, setPulsing] = useState(false);
  function onConfirm() {
    if (signed) return;
    confirmMtaHash(hashId);
    setPulsing(true);
    setTimeout(() => setPulsing(false), 700);
  }
  return (
    <motion.div
      layout
      animate={{
        backgroundColor: pulsing ? 'var(--color-success-bg)' : 'var(--color-surface)',
      }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="hairline"
      style={{
        borderRadius: 'var(--radius-card)',
        padding: '12px 16px',
        display: 'grid',
        gridTemplateColumns: '22px 1fr auto',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <motion.div
        animate={{ scale: pulsing ? 1.15 : 1 }}
        transition={{ duration: 0.2 }}
        style={{
          width: 16,
          height: 16,
          marginTop: 2,
          borderRadius: 999,
          border: `1px solid ${signed ? 'var(--color-success)' : 'var(--color-rule-mid)'}`,
          background: signed ? 'var(--color-success)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden
      >
        <AnimatePresence>
          {signed && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.05, 1], opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              style={{ display: 'inline-flex' }}
            >
              <Check size={10} strokeWidth={2} color="white" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <div style={{ minWidth: 0 }}>
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
          }}
        >
          hash {index} · {title}
        </div>
        <div
          className="serif"
          style={{
            fontSize: 13.5,
            color: 'var(--color-ink)',
            marginTop: 4,
            letterSpacing: '-0.005em',
            lineHeight: 1.5,
          }}
        >
          {primary}
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 11.5,
            color: 'var(--color-ink-faint)',
            marginTop: 3,
            lineHeight: 1.55,
          }}
        >
          ↳ {citation}
        </div>
      </div>
      <div style={{ paddingTop: 2 }}>
        {signed ? (
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.06em',
            }}
          >
            ✓ signed
          </span>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center"
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-button)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-bg)',
              background: 'var(--color-accent)',
              border: '0.5px solid var(--color-accent)',
            }}
          >
            Confirm hash →
          </button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Convenience wrapper that owns the commit handler + seam timing.
 * Used by the post-bind canvas to compose ceremony + commit.
 */
export function MtaCeremonyContainer() {
  const setSeamFiring = useRanBerri((s) => s.setSeamFiring);
  const [committing, setCommitting] = useState(false);

  async function onIssue() {
    if (committing) return;
    setCommitting(true);
    setSeamFiring(true);
    await new Promise((r) => setTimeout(r, 200));
    try {
      commitMta('nm');
    } catch (err) {
      console.error('commitMta failed', err);
      setSeamFiring(false);
      setCommitting(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 460));
    setSeamFiring(false);
    setCommitting(false);
  }

  return <MtaCeremony onIssue={onIssue} committing={committing} />;
}
