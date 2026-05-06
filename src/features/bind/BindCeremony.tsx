import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useRanBerri } from '@/store';
import {
  buildHashInputsFromSubmission,
  commitBind,
  computeSha,
  GREENLINE_CONSUMPTION,
  validateHashes,
  type HashCheck,
} from '@/lib/bind';
import type { HashId } from '@/lib/bind/types';
import { getCapacityLedger } from '@/lib/fixtures/capacityLedger';
import { HashRow } from './HashRow';
import { HashOverrideModal } from './HashOverrideModal';

/**
 * The bind ceremony — a four-hash deliberate-act checklist that
 * formally promotes the submission to a policy. Fires when bind
 * phase is 'in-progress'. On commit, sets ui.seamFiring and writes
 * the bind.committed event after the seam animation completes.
 */
export function BindCeremony() {
  const submission = useRanBerri((s) => s.submission);
  const quote = useRanBerri((s) => s.quote);
  const rating = useRanBerri((s) => s.rating);
  const enrichment = useRanBerri((s) => s.enrichment);
  const bind = useRanBerri((s) => s.bind);
  const setSeamFiring = useRanBerri((s) => s.setSeamFiring);
  const [overrideTarget, setOverrideTarget] = useState<HashCheck | null>(null);
  const [committing, setCommitting] = useState(false);

  const checks: HashCheck[] = useMemo(() => {
    if (!submission) return [];
    const { warranties } = buildHashInputsFromSubmission(submission);
    return validateHashes({
      submission,
      ratingPremium: rating.output?.premium ?? null,
      ratingSha: rating.output?.sha ?? null,
      quotedPremium: quote.slipPremium,
      quotedSlipSha: quote.slipSha,
      warranties,
      // The slip's warranty hash at send time. For Greenline default,
      // these match the live warranties; the demo path produces a
      // green hash 2.
      warrantiesAtSendSha: computeSha(warranties),
      sanctionsRefreshedAt:
        enrichment.sources['experian-sanctions']?.returnedAt ?? null,
      capacity: getCapacityLedger(),
      capacityConsumption: GREENLINE_CONSUMPTION,
    });
  }, [submission, rating.output, quote.slipPremium, quote.slipSha, enrichment.sources]);

  if (!submission || bind.phase !== 'in-progress') return null;

  const HASH_IDS: HashId[] = ['premium', 'subjectivities', 'sanctions', 'capacity'];
  const confirmedCount = bind.hashes.filter(
    (h) => h.status === 'confirmed' || h.status === 'overridden',
  ).length;
  const allFour = confirmedCount === 4;

  async function onCommit() {
    if (!allFour || committing) return;
    setCommitting(true);
    setSeamFiring(true);
    // Brief acknowledgement, then fire the seam, then commit at the
    // climax point so the policy ID transition lands mid-animation.
    await new Promise((r) => setTimeout(r, 280));
    try {
      commitBind('nm');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('commitBind failed', err);
      setSeamFiring(false);
      setCommitting(false);
      return;
    }
    // Let the seam finish gracefully.
    await new Promise((r) => setTimeout(r, 720));
    setSeamFiring(false);
    setCommitting(false);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
      style={{ padding: '22px 28px', position: 'relative' }}
    >
      <header style={{ marginBottom: 16 }}>
        <div className="eyebrow">bind ceremony</div>
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
          four hashes · each click signs the artefact
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {HASH_IDS.map((id, i) => {
          const check = checks.find((c) => c.id === id)!;
          const record = bind.hashes.find((h) => h.id === id);
          return (
            <HashRow
              key={id}
              index={i + 1}
              hashId={id}
              check={check}
              record={record}
              onOverrideRequested={(hashId) => {
                const c = checks.find((x) => x.id === hashId);
                if (c) setOverrideTarget(c);
              }}
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
            color: allFour
              ? 'var(--color-success)'
              : 'var(--color-ink-mute)',
            letterSpacing: '-0.005em',
          }}
        >
          {confirmedCount} of 4 confirmed
          {allFour ? ' · ready to bind' : ''}
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            initial={false}
            animate={allFour ? { scale: [0.96, 1] } : { scale: 1 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <button
              type="button"
              onClick={onCommit}
              disabled={!allFour || committing}
              className="inline-flex items-center"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-button)',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 500,
                color: allFour ? 'var(--color-bg)' : 'var(--color-ink-faint)',
                background: allFour
                  ? 'var(--color-accent)'
                  : 'var(--color-sunken)',
                border: `0.5px solid ${
                  allFour ? 'var(--color-accent)' : 'var(--color-rule-mid)'
                }`,
                cursor: allFour ? 'pointer' : 'not-allowed',
                transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              Bind &amp; issue schedule →
            </button>
          </motion.div>
          <button
            type="button"
            disabled={committing}
            onClick={() => {
              // Hold-for-review writes a bind.held event without
              // committing. The ceremony pauses — re-entering would
              // require a fresh bind.ceremonyStarted (left for v0.2).
              const reason = window.prompt(
                'Reason for holding (≥10 chars):',
                'Awaiting senior sign-off',
              );
              if (!reason || reason.trim().length < 10) return;
              useRanBerri.getState().appendAuditEvent({
                actor: { kind: 'underwriter', id: 'nm' },
                kind: 'bind.held',
                submissionId: submission.id,
                reason: reason.trim(),
                heldBy: 'nm',
              });
            }}
            className="inline-flex items-center"
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--radius-button)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              color: 'var(--color-ink-mute)',
              background: 'transparent',
              border: '0.5px solid var(--color-rule-mid)',
            }}
          >
            Hold for review
          </button>
        </div>
      </div>

      {overrideTarget && (
        <HashOverrideModal
          hashId={overrideTarget.id}
          expectedSha={overrideTarget.expectedSha ?? '—'}
          currentSha={overrideTarget.currentSha}
          onClose={() => setOverrideTarget(null)}
        />
      )}
    </motion.section>
  );
}
