import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { HistoricalBinder, LossToCompetitor } from '@/lib/fixtures';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

type RecordTarget =
  | { kind: 'binder'; record: HistoricalBinder }
  | { kind: 'loss'; record: LossToCompetitor };

type Props = {
  target: RecordTarget;
  onClose: () => void;
};

/**
 * Sub-inspector that opens on top of the DeepDiveInspector when a
 * binder or loss row is clicked. Shows the full record so the
 * recommendation can be audited down to the underlying datum.
 */
export function RecordDetailModal({ target, onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-label={target.kind === 'binder' ? 'Binder detail' : 'Loss detail'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.32)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="hairline"
        style={{
          width: 520,
          maxWidth: '100%',
          maxHeight: '80vh',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-button)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(31, 30, 29, 0.18)',
        }}
      >
        <div
          className="hairline-b flex items-center justify-between"
          style={{ padding: '12px 18px', flex: '0 0 auto' }}
        >
          <div>
            <div className="eyebrow">
              {target.kind === 'binder' ? 'binder · detail' : 'loss · detail'}
            </div>
            <div
              className="serif"
              style={{
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                marginTop: 2,
                color: 'var(--color-ink)',
              }}
            >
              {target.record.insuredName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: 6, color: 'var(--color-ink-mute)' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
          {target.kind === 'binder' ? (
            <BinderBody binder={target.record} />
          ) : (
            <LossBody loss={target.record} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function BinderBody({ binder }: { binder: HistoricalBinder }) {
  const lr = binder.actualLossRatio;
  const lrText =
    lr !== null
      ? `${Math.round(lr * 100)}%`
      : binder.matured === false
        ? 'in-force'
        : '—';
  const lrTone =
    lr === null
      ? 'var(--color-ink-faint)'
      : lr <= 0.5
        ? 'var(--color-success)'
        : lr <= 0.75
          ? 'var(--color-warn)'
          : 'var(--color-danger)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Row label="ID" value={binder.id} mono />
      <Row label="Bound" value={DATE_FMT.format(new Date(binder.boundAt))} />
      <Row
        label="Turnover"
        value={`£${(binder.turnover / 1_000_000).toFixed(2)}M`}
        mono
      />
      <Row label="Sites" value={String(binder.siteCount)} mono />
      <Row label="Materials" value={binder.materials.join(', ')} />
      <Row label="Fire suppression" value={binder.fireSuppression} />
      <Row
        label="Years in business"
        value={String(binder.yearsInBusiness)}
        mono
      />
      <Row label="Geography" value={binder.geography.join(' · ')} />
      <Row
        label="Prior LR"
        value={`${Math.round(binder.priorLossRatio * 100)}%`}
        mono
      />
      <Row
        label="Actual LR"
        value={lrText}
        mono
        tone={lrTone}
      />
      {binder.profitability && (
        <Row label="Outcome" value={binder.profitability} />
      )}
      {binder.earnedPremium !== null && (
        <Row
          label="Earned premium"
          value={`£${binder.earnedPremium.toLocaleString('en-GB')}`}
          mono
        />
      )}
      {binder.incurredLoss !== null && (
        <Row
          label="Incurred loss"
          value={`£${binder.incurredLoss.toLocaleString('en-GB')}`}
          mono
        />
      )}
      <Row label="Underwriter" value={binder.underwriter} />
      <Row label="Capacity" value={binder.capacity} />
    </div>
  );
}

function LossBody({ loss }: { loss: LossToCompetitor }) {
  const delta =
    loss.competitorWinningPremium !== null
      ? loss.ourQuotedPremium - loss.competitorWinningPremium
      : null;
  const deltaPct =
    loss.competitorWinningPremium !== null
      ? Math.round(
          ((loss.ourQuotedPremium - loss.competitorWinningPremium) /
            loss.ourQuotedPremium) *
            100,
        )
      : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Row label="ID" value={loss.id} mono />
      <Row label="Quoted" value={DATE_FMT.format(new Date(loss.quotedAt))} />
      <Row label="Lost" value={DATE_FMT.format(new Date(loss.lostAt))} />
      <Row
        label="Our quote"
        value={`£${loss.ourQuotedPremium.toLocaleString('en-GB')}`}
        mono
      />
      <Row
        label="Competitor"
        value={
          loss.competitorWinningPremium !== null
            ? `${loss.competitorWhoWon} · £${loss.competitorWinningPremium.toLocaleString('en-GB')} (${loss.confidenceInCompetitorPrice})`
            : `${loss.competitorWhoWon} · price unknown`
        }
      />
      {delta !== null && deltaPct !== null && (
        <Row
          label="Delta"
          value={`£${delta.toLocaleString('en-GB')} · ${deltaPct}% above`}
          mono
          tone={deltaPct > 0 ? 'var(--color-warn)' : 'var(--color-ink-soft)'}
        />
      )}
      <Row label="Primary reason" value={loss.primaryReason} />
      <Row
        label="Turnover"
        value={`£${(loss.turnover / 1_000_000).toFixed(2)}M`}
        mono
      />
      <Row label="Sites" value={String(loss.siteCount)} mono />
      <Row label="Materials" value={loss.materials.join(', ')} />
      <Row label="Fire suppression" value={loss.fireSuppression} />
      <Row
        label="Prior LR"
        value={`${Math.round(loss.priorLossRatio * 100)}%`}
        mono
      />
      <Row label="Geography" value={loss.geography.join(' · ')} />
      <Row label="Captured by" value={loss.capturedBy} />
      <div style={{ marginTop: 4 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>
          detail
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--color-ink-soft)',
            letterSpacing: '-0.005em',
          }}
        >
          {loss.detail}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        columnGap: 14,
        alignItems: 'baseline',
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
        }}
      >
        {label}
      </span>
      <span
        className={mono ? 'mono' : undefined}
        style={{
          fontSize: 12.5,
          color: tone ?? 'var(--color-ink)',
          letterSpacing: mono ? '0.02em' : '-0.005em',
        }}
      >
        {value}
      </span>
    </div>
  );
}
