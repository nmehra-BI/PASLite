import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useRanBerri } from '@/store';
import { getActiveConfig } from '@/config';
import {
  commitRenewal,
  confirmRenewalHash,
  sendRenewalSchedule,
} from '@/lib/renewal';
import type { RenewalHashRecord } from '@/lib/renewal';

type HashId = RenewalHashRecord['id'];

const renewalCfg = getActiveConfig();
const renewalCapacityLabel = `${renewalCfg.metadata.capacityProvider.name} · ${(renewalCfg.capacity.capacityProviderAllocation * 100).toFixed(0)}% line maintained for year 2`;

const HASHES: Array<{
  id: HashId;
  index: number;
  title: string;
  primary: (selectedPremium: number, sha: string | null) => string;
  citation: (sha: string | null) => string;
}> = [
  {
    id: 'premium',
    index: 1,
    title: 'Premium',
    primary: (p) =>
      `Renewal premium £${p.toLocaleString('en-GB')} confirmed against year-2 rating`,
    citation: (sha) =>
      sha ? `${sha} · year-2 sealed` : 'year-2 sealed',
  },
  {
    id: 'subjectivities',
    index: 2,
    title: 'Subjectivities',
    primary: () =>
      'Year-1 warranties carry forward + WEEE conditional warranty added for year 2',
    citation: () =>
      'subjectivity-set v2 · sealed at renewal commit',
  },
  {
    id: 'sanctions',
    index: 3,
    title: 'Sanctions',
    primary: () => 'Sanctions screening clear · re-run at renewal',
    citation: () => 'directors + entity · cleared',
  },
  {
    id: 'capacity',
    index: 4,
    title: 'Capacity',
    primary: () => renewalCapacityLabel,
    citation: () => 'within syndicate headroom',
  },
];

/**
 * The renewal ceremony — 4 hashes, mirrors BindCeremony / MtaCeremony.
 * Once all four are signed, "Issue renewal & succeed →" arms; the
 * commit triggers the seam animation and then sends the renewal
 * schedule.
 */
export function RenewalCeremony() {
  const renewal = useRanBerri((s) => s.renewal);
  const setSeamFiring = useRanBerri((s) => s.setSeamFiring);
  const [committing, setCommitting] = useState(false);

  const slipSent = renewal.slip.sentAt !== null;
  const armed =
    slipSent &&
    (renewal.phase === 'slip-ready' ||
      renewal.phase === 'ceremony-in-progress' ||
      renewal.phase === 'committed' ||
      renewal.phase === 'sent');

  if (!armed) return null;

  const confirmedCount = renewal.hashes.filter(
    (h) => h.status === 'confirmed' || h.status === 'overridden',
  ).length;
  const allFour = confirmedCount === 4;
  const alreadyCommitted =
    renewal.phase === 'committed' || renewal.phase === 'sent';

  async function onIssue() {
    if (committing || !allFour || alreadyCommitted) return;
    setCommitting(true);
    setSeamFiring(true);
    // Brief pause so the seam animation begins to play before the
    // commit event lands and the canvas swaps to year-2.
    await new Promise((r) => setTimeout(r, 240));
    try {
      commitRenewal('nm');
    } catch (err) {
      console.error('commitRenewal failed', err);
      setSeamFiring(false);
      setCommitting(false);
      return;
    }
    // Full-intensity seam: 1000ms, equal to bind.
    await new Promise((r) => setTimeout(r, 760));
    setSeamFiring(false);
    setCommitting(false);
    // Send the renewal schedule on commit.
    try {
      sendRenewalSchedule('nm');
    } catch (err) {
      console.error('sendRenewalSchedule failed', err);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="hairline-t"
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">renewal ceremony · four hashes</div>
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
          succession sign-off · mirrors the year-1 bind ceremony
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {HASHES.map((h) => {
          const record = renewal.hashes.find((x) => x.id === h.id);
          const signed =
            record?.status === 'confirmed' || record?.status === 'overridden';
          return (
            <Row
              key={h.id}
              hashId={h.id}
              index={h.index}
              title={h.title}
              primary={h.primary(
                renewal.selectedOption?.premium ?? renewal.slip.premium ?? 0,
                renewal.slip.sha,
              )}
              citation={h.citation(record?.artefactSha ?? renewal.slip.sha)}
              signed={signed}
              disabled={alreadyCommitted}
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
            color: allFour ? 'var(--color-success)' : 'var(--color-ink-mute)',
            letterSpacing: '-0.005em',
          }}
        >
          {confirmedCount} of 4 confirmed
          {allFour && !alreadyCommitted ? ' · ready to issue' : ''}
          {alreadyCommitted ? ' · succession committed' : ''}
        </div>
        <motion.div
          initial={false}
          animate={allFour ? { scale: [0.96, 1] } : { scale: 1 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <button
            type="button"
            onClick={onIssue}
            disabled={!allFour || committing || alreadyCommitted}
            className="inline-flex items-center"
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--radius-button)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              fontWeight: 500,
              color:
                allFour && !alreadyCommitted ? 'var(--color-bg)' : 'var(--color-ink-faint)',
              background:
                allFour && !alreadyCommitted
                  ? 'var(--color-accent)'
                  : 'var(--color-sunken)',
              border: `0.5px solid ${
                allFour && !alreadyCommitted ? 'var(--color-accent)' : 'var(--color-rule-mid)'
              }`,
              cursor:
                allFour && !alreadyCommitted && !committing ? 'pointer' : 'not-allowed',
              transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {alreadyCommitted ? 'Succession issued ✓' : 'Issue renewal & succeed →'}
          </button>
        </motion.div>
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
  disabled,
}: {
  hashId: HashId;
  index: number;
  title: string;
  primary: string;
  citation: string;
  signed: boolean;
  disabled: boolean;
}) {
  const [pulsing, setPulsing] = useState(false);
  function onConfirm() {
    if (signed || disabled) return;
    confirmRenewalHash(hashId);
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
            disabled={disabled}
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
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            Confirm hash →
          </button>
        )}
      </div>
    </motion.div>
  );
}
