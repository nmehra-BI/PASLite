import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';
import type { CellReplayRecord } from '@/store/replay';
import { formatGBP, formatPercent, runRating } from '@/lib/rating';
import { useRanBerri } from '@/store';
import { effectiveValue } from '@/lib/field';
import type { LossRun } from '@/lib/fixtures';

type Props = {
  cell: CellReplayRecord | null;
  onClose: () => void;
};

/**
 * Cell-detail inspector with sensitivity slider. The slider shows
 * what-if impact only — committing the change requires correcting the
 * upstream Field<T>, which marks rating stale and forces a rerun.
 *
 * For B14 (turnover), the slider sweeps £1M–£20M and updates the
 * cell's recomputed contribution in real time. The change does NOT
 * propagate to subsequent cells — that's by design.
 */
export function CellInspector({ cell, onClose }: Props) {
  const [whatIf, setWhatIf] = useState<number | null>(null);
  const submission = useRanBerri((s) => s.submission);

  useEffect(() => {
    setWhatIf(null);
  }, [cell?.ref]);

  const baseInputs = useMemo(() => {
    if (!submission) return null;
    const turnover =
      (effectiveValue(submission.insured.turnover) as number | null) ?? 0;
    const yearsInBusiness =
      (effectiveValue(submission.insured.yearsTrading) as number | null) ?? 0;
    const sites = submission.sites.length;
    const materials =
      (effectiveValue(submission.materials) as string[] | null) ?? [];
    const fsValue = effectiveValue(submission.fireSuppressionDisclosed) as
      | boolean
      | null;
    const fireSuppression: 'present' | 'absent' | 'undisclosed' =
      fsValue === true ? 'present' : fsValue === false ? 'absent' : 'undisclosed';
    const lossRatio =
      (effectiveValue(submission.statedLossRatio) as number | null) ?? 0;
    const lossRuns =
      (effectiveValue(submission.lossRuns) as LossRun[] | null) ?? [];
    const largestSingleClaim = lossRuns.reduce(
      (max, r) => Math.max(max, r.amount),
      0,
    );
    return {
      turnover,
      siteCount: sites,
      materials,
      fireSuppression,
      lossRatio,
      largestSingleClaim,
      yearsInBusiness,
    };
  }, [submission]);

  const sliderConfig = useMemo(() => {
    if (!cell) return null;
    if (cell.ref === 'B14') {
      return {
        label: 'turnover',
        min: 1_000_000,
        max: 20_000_000,
        step: 100_000,
        format: (n: number) => formatGBP(n),
      };
    }
    if (cell.ref === 'F44') {
      return {
        label: 'loss ratio',
        min: 0,
        max: 1.5,
        step: 0.01,
        format: (n: number) => `${(n * 100).toFixed(0)}%`,
      };
    }
    return null;
  }, [cell]);

  const sliderInitial = useMemo(() => {
    if (!cell || !baseInputs || !sliderConfig) return null;
    if (cell.ref === 'B14') return baseInputs.turnover;
    if (cell.ref === 'F44') return baseInputs.lossRatio;
    return null;
  }, [cell, baseInputs, sliderConfig]);

  const recomputed = useMemo(() => {
    if (!cell || !baseInputs || whatIf === null) return null;
    if (cell.ref === 'B14') {
      const out = runRating({ ...baseInputs, turnover: whatIf });
      return out.cells.find((c) => c.ref === 'B14')!;
    }
    if (cell.ref === 'F44') {
      const out = runRating({ ...baseInputs, lossRatio: whatIf });
      return out.cells.find((c) => c.ref === 'F44')!;
    }
    return null;
  }, [cell, baseInputs, whatIf]);

  return (
    <AnimatePresence>
      {cell && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(31, 30, 29, 0.06)',
              zIndex: 10,
            }}
            aria-hidden
          />
          <motion.aside
            key="panel"
            initial={{ x: 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="hairline-l"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 380,
              background: 'var(--color-surface)',
              zIndex: 11,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div
              className="hairline-b flex items-center justify-between"
              style={{ padding: '12px 18px', flex: '0 0 auto' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--color-ink-mute)',
                    letterSpacing: '0.06em',
                  }}
                >
                  cell
                </span>
                <ChevronRight
                  size={11}
                  strokeWidth={1.5}
                  style={{ color: 'var(--color-ink-faint)' }}
                />
                <span
                  className="mono"
                  style={{ fontSize: 12, color: 'var(--color-ink)' }}
                >
                  {cell.ref}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{ padding: 4, color: 'var(--color-ink-mute)' }}
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
              <div
                className="mono"
                style={{
                  fontSize: 12,
                  color: 'var(--color-ink-soft)',
                  letterSpacing: '0.04em',
                }}
              >
                {cell.label}
              </div>
              <div
                className="serif"
                style={{
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: 'var(--color-ink-mute)',
                  marginTop: 8,
                  lineHeight: 1.55,
                }}
              >
                {cell.formula}
              </div>

              {cell.inputs.length > 0 && (
                <div className="hairline-t" style={{ marginTop: 14, paddingTop: 12 }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>
                    inputs
                  </div>
                  {cell.inputs.map((inp) => (
                    <div
                      key={inp.path}
                      className="flex items-baseline gap-3"
                      style={{ padding: '2px 0' }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: 'var(--color-ink-mute)',
                          letterSpacing: '0.06em',
                          minWidth: 80,
                        }}
                      >
                        {inp.label}
                      </span>
                      <span
                        className="mono"
                        style={{ fontSize: 11.5, color: 'var(--color-ink)' }}
                      >
                        {Array.isArray(inp.value)
                          ? (inp.value as unknown[]).join(', ')
                          : String(inp.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="hairline-t" style={{ marginTop: 14, paddingTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  output
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 16,
                    color: 'var(--color-ink)',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.005em',
                  }}
                >
                  {cell.format === 'percent'
                    ? formatPercent(cell.value, 2)
                    : formatGBP(cell.value)}
                </div>
              </div>

              {sliderConfig && sliderInitial !== null && (
                <div
                  className="hairline-t"
                  style={{ marginTop: 14, paddingTop: 12 }}
                >
                  <div className="eyebrow" style={{ marginBottom: 6 }}>
                    sensitivity · {sliderConfig.label}
                  </div>
                  <input
                    type="range"
                    min={sliderConfig.min}
                    max={sliderConfig.max}
                    step={sliderConfig.step}
                    value={whatIf ?? sliderInitial}
                    onChange={(e) => setWhatIf(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--color-accent)' }}
                  />
                  <div
                    className="flex items-baseline justify-between"
                    style={{ marginTop: 4 }}
                  >
                    <span
                      className="mono"
                      style={{ fontSize: 10.5, color: 'var(--color-ink-faint)' }}
                    >
                      {sliderConfig.format(sliderConfig.min)}
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 10.5, color: 'var(--color-ink-faint)' }}
                    >
                      {sliderConfig.format(sliderConfig.max)}
                    </span>
                  </div>
                  <div
                    className="hairline"
                    style={{
                      marginTop: 10,
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-button)',
                      background: 'var(--color-bg)',
                    }}
                  >
                    <div
                      className="serif"
                      style={{
                        fontStyle: 'italic',
                        fontSize: 11.5,
                        color: 'var(--color-ink-mute)',
                      }}
                    >
                      what-if · doesn&rsquo;t propagate
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 13,
                        color: 'var(--color-ink)',
                        marginTop: 2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {sliderConfig.format(whatIf ?? sliderInitial)} →{' '}
                      {recomputed
                        ? recomputed.format === 'percent'
                          ? formatPercent(recomputed.value, 2)
                          : formatGBP(recomputed.value)
                        : '—'}
                    </div>
                  </div>
                  <p
                    className="serif"
                    style={{
                      fontStyle: 'italic',
                      fontSize: 11,
                      color: 'var(--color-ink-faint)',
                      marginTop: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    Committing requires correcting the field upstream, which
                    marks rating stale.
                  </p>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
