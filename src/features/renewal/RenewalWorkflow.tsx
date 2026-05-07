import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useRanBerri } from '@/store';
import { deriveCursorView } from '@/lib/lifecycle/cursorView';
import { Year1ReviewPanel } from './Year1ReviewPanel';
import { Year2ChangesPanel } from './Year2ChangesPanel';
import { DefencePricingPanel } from './DefencePricingPanel';
import { RenewalRecommendationPanel } from './RenewalRecommendationPanel';
import { RenewalSlipPanel } from './RenewalSlipPanel';
import { RenewalCeremony } from './RenewalCeremony';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const GBP = (n: number) => `£${n.toLocaleString('en-GB')}`;

/**
 * Compose the renewal workflow inside the post-bind canvas. Each
 * stage renders only when its replay conditions hold, so the UI is
 * purely derived from the audit log + renewal store slice.
 *
 * Hidden when scrubbed back to year-1 bind (cursorView 'bind-v1' /
 * 'mta-v2'); the historical view should look like the predecessor
 * state, not the in-flight renewal workspace.
 */
export function RenewalWorkflow() {
  const renewal = useRanBerri((s) => s.renewal);
  const policy = useRanBerri((s) => s.policy);
  const cursor = useRanBerri((s) => s.lifecycle.cursor);
  const now = useRanBerri((s) => s.lifecycle.now);
  const cancellation = useRanBerri((s) => s.cancellation);

  if (renewal.phase === 'idle') return null;

  // In historical scrub views, hide the live workflow.
  const view = deriveCursorView({
    cursor,
    now,
    baseBindAt: policy.baseBindAt,
    versionCount: policy.versions.length,
    firstMtaSignedAt: policy.versions[0]?.signedAt ?? null,
    cancelledAt: cancellation.committedAt,
    cancelled:
      cancellation.phase === 'committed' || cancellation.phase === 'sent',
    renewedAt: renewal.committedAt,
    renewed: renewal.phase === 'committed' || renewal.phase === 'sent',
  });
  if (view.kind === 'bind-v1' || view.kind === 'mta-v2') return null;

  return (
    <>
      <RenewalBanner />
      <Year1ReviewPanel />
      <Year2ChangesPanel />
      <DefencePricingPanel />
      <RenewalRecommendationPanel />
      <RenewalSlipPanel />
      <RenewalCeremony />
      <SuccessionStrip />
    </>
  );
}

function RenewalBanner() {
  const renewal = useRanBerri((s) => s.renewal);
  if (renewal.phase === 'idle') return null;
  if (renewal.phase === 'committed' || renewal.phase === 'sent') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="hairline-b"
      style={{
        background: 'rgba(201, 99, 66, 0.06)',
        padding: '10px 28px',
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 16,
        marginTop: 14,
      }}
    >
      <div className="flex items-baseline gap-3" style={{ minWidth: 0 }}>
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
          }}
        >
          renewal triggered · {renewal.renewalId ?? '—'}
        </span>
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            letterSpacing: '-0.005em',
          }}
        >
          succeeding {renewal.priorPolicyRef ?? '—'} into year 2
        </span>
      </div>
    </motion.div>
  );
}

function SuccessionStrip() {
  const renewal = useRanBerri((s) => s.renewal);
  if (renewal.phase !== 'committed' && renewal.phase !== 'sent') return null;
  if (!renewal.successorPolicyRef || renewal.committedAt === null) return null;

  const inception = renewal.inceptionDate
    ? DATE_FMT.format(new Date(renewal.inceptionDate))
    : '—';
  const expiry = renewal.expiryDate
    ? DATE_FMT.format(new Date(renewal.expiryDate))
    : '—';
  const premium = renewal.selectedOption?.premium ?? renewal.slip.premium ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.2 }}
      className="hairline-t"
      style={{
        margin: '14px 28px 24px',
        padding: '14px 16px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-success-bg)',
        border: '0.5px solid var(--color-success)',
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
      }}
    >
      <Check
        size={16}
        strokeWidth={1.75}
        style={{ color: 'var(--color-success)', position: 'relative', top: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="serif"
          style={{
            fontSize: 14.5,
            fontWeight: 500,
            color: 'var(--color-success)',
            letterSpacing: '-0.005em',
          }}
        >
          {renewal.successorPolicyRef} · year 2 in force · {GBP(premium)}
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            marginTop: 3,
            letterSpacing: '-0.005em',
          }}
        >
          inception {inception} · expiry {expiry} · year-1 archived to history
        </div>
      </div>
    </motion.div>
  );
}
