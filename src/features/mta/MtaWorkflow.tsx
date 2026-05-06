import { motion } from 'framer-motion';
import { Check, FileText } from 'lucide-react';
import { useRanBerri } from '@/store';
import { MtaIntakeBanner } from './MtaIntakeBanner';
import { PolicyContextReview } from './PolicyContextReview';
import { DeltaRatingSequence } from './DeltaRatingSequence';
import { CapacityRecheckPanel } from './CapacityRecheckPanel';
import { MtaScheduleSection } from './MtaScheduleSection';
import { MtaCeremonyContainer } from './MtaCeremony';
import { MtaScheduleSend } from './MtaScheduleSend';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Compose the MTA workflow inside the post-bind canvas. Each stage
 * renders only when its replay conditions hold, so the UI is purely
 * derived from the audit log.
 */
export function MtaWorkflow() {
  const mta = useRanBerri((s) => s.mta);
  const policy = useRanBerri((s) => s.policy);
  const setShowCertificate = useRanBerri((s) => s.setShowCertificate);

  if (mta.phase === 'idle' && policy.versions.length === 0) return null;

  const isExtracting =
    mta.phase === 'received' || mta.phase === 'extracting';

  return (
    <>
      <MtaIntakeBanner />

      {isExtracting && <ExtractionPlaceholder />}

      <PolicyContextReview />
      <DeltaRatingSequence />
      <CapacityRecheckPanel />
      <MtaScheduleSection />
      <MtaCeremonyContainer />
      <MtaScheduleSend />

      {policy.versions.length > 0 && mta.phase !== 'idle' && (
        <PostMtaSummaryStrip
          onOpenCertificate={() => setShowCertificate(true)}
        />
      )}
    </>
  );
}

function ExtractionPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24 }}
      style={{ padding: '24px 28px' }}
    >
      <div className="eyebrow mb-3">extracting MTA</div>
      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 16,
          color: 'var(--color-ink-mute)',
          margin: 0,
          letterSpacing: '-0.005em',
        }}
      >
        Reading broker email + survey&hellip;
      </p>
    </motion.div>
  );
}

function PostMtaSummaryStrip({ onOpenCertificate }: { onOpenCertificate: () => void }) {
  const mta = useRanBerri((s) => s.mta);
  const policy = useRanBerri((s) => s.policy);
  const latest = policy.versions[policy.versions.length - 1];
  if (!latest) return null;
  const committed = mta.committedAt ? new Date(mta.committedAt) : null;
  const summary = committed
    ? `MTA-0${latest.endorsementNumber} issued · ${DATE_FMT.format(committed)} · AP £${latest.proRatedAP.toLocaleString('en-GB')}`
    : `MTA-0${latest.endorsementNumber} issued · AP £${latest.proRatedAP.toLocaleString('en-GB')}`;
  return (
    <motion.button
      type="button"
      onClick={onOpenCertificate}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="hairline-t"
      style={{
        margin: '14px 28px 24px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-success-bg)',
        border: '0.5px solid var(--color-success)',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        width: 'calc(100% - 56px)',
      }}
    >
      <Check size={14} strokeWidth={1.75} style={{ color: 'var(--color-success)' }} />
      <span
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13.5,
          color: 'var(--color-success)',
          letterSpacing: '-0.005em',
          flex: 1,
        }}
      >
        ✓ {summary}
      </span>
      <span
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-success)',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          textDecorationStyle: 'dotted',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <FileText size={11} strokeWidth={1.5} />
        View bind certificate →
      </span>
    </motion.button>
  );
}
