import { motion } from 'framer-motion';
import { Check, FileText } from 'lucide-react';
import { useRanBerri } from '@/store';
import { ScheduleSection } from './ScheduleSection';
import { SubjectivitiesPanel } from './SubjectivitiesPanel';
import { SubjectivityInspector } from './SubjectivityInspector';
import { BoundCertificate } from './BoundCertificate';
import { MtaIntakeButton, MtaWorkflow } from '@/features/mta';
import {
  CancellationIntakeButton,
  CancellationWorkflow,
} from '@/features/cancellation';
import { ChapterAnchor } from '@/features/lifecycle/ChapterAnchor';

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

/**
 * The post-bind canvas. Renders when bind.phase === 'committed'.
 * Header, bind summary strip, schedule section, subjectivities,
 * certificate-on-demand. The lifecycle ribbon and decision trail
 * stay where they are (in Cockpit + DecisionTrail).
 */
export function PostBindCanvas() {
  const bind = useRanBerri((s) => s.bind);
  const showCertificate = useRanBerri((s) => s.ui.showCertificate);
  const setShowCertificate = useRanBerri((s) => s.setShowCertificate);

  if (bind.phase !== 'committed') return null;

  const committedAt = bind.committedAt ? new Date(bind.committedAt) : null;
  const summary = committedAt
    ? `Bound ${DATE_FMT.format(committedAt)} ${TIME_FMT.format(committedAt)} · 4 hashes signed · ${bind.policyRef ?? '—'}`
    : `Bound · ${bind.policyRef ?? '—'}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'auto',
        background: 'var(--color-bg)',
      }}
    >
      {/* Bind chapter stays anchor-only: the user has just landed
          on the bound policy and the schedule + subjectivities are
          the post-bind monitoring surface they expect to see. */}
      <ChapterAnchor chapter="bind">
        <button
          type="button"
          onClick={() => setShowCertificate(true)}
          style={{
            margin: '14px 28px 0',
            padding: '10px 14px',
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-success-bg)',
            border: '0.5px solid var(--color-success)',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
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
            {summary}
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
        </button>
        <ScheduleSection />
        <SubjectivitiesPanel />
      </ChapterAnchor>
      {/* MTA + cancellation stay anchor-only: their entry points
          (the intake buttons) must remain clickable when the chapter
          is "pending", which the SectionCollapse greyout would
          break. The workflows themselves render their own internal
          structure once active. */}
      <ChapterAnchor chapter="mta-04">
        <MtaIntakeButton />
        <MtaWorkflow />
      </ChapterAnchor>
      <ChapterAnchor chapter="cancellation">
        <CancellationIntakeButton />
        <CancellationWorkflow />
      </ChapterAnchor>

      <SubjectivityInspector />
      {showCertificate && (
        <BoundCertificate onClose={() => setShowCertificate(false)} />
      )}
    </motion.div>
  );
}
