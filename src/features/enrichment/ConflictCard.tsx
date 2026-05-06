import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components';
import { useRanBerri } from '@/store';
import type { ConflictRecord } from '@/store/replay';

type Choice = 'broker' | 'external' | 'custom';

type Props = {
  conflict: ConflictRecord;
};

const formatGBP = (v: unknown) =>
  typeof v === 'number' ? `£${v.toLocaleString()}` : String(v);

/**
 * The 3-column conflict-resolution card. Two voices on the left and
 * middle (broker = italic serif, external = monospace numeric); the
 * underwriter's call on the right.
 *
 * The typographic contrast IS the design. The broker's column reads
 * like a quoted email; the regulator's column reads like an official
 * record.
 */
export function ConflictCard({ conflict }: Props) {
  const resolveConflict = useRanBerri((s) => s.resolveConflict);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [reason, setReason] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    choice !== null &&
    reason.trim().length >= 8 &&
    (choice !== 'custom' || parseCustomNumber(customValue) !== null);

  function handleResolve() {
    setError(null);
    if (!choice) return;
    let value: unknown;
    if (choice === 'broker') value = conflict.brokerValue;
    else if (choice === 'external') value = conflict.externalValue;
    else {
      const n = parseCustomNumber(customValue);
      if (n === null) {
        setError('Enter a valid number for the custom value.');
        return;
      }
      value = n;
    }
    try {
      resolveConflict({
        conflictId: conflict.id,
        fieldPath: conflict.fieldPath,
        choice,
        value,
        reason: reason.trim(),
        resolvedBy: 'nm',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const broker = formatGBP(conflict.brokerValue);
  const external = formatGBP(conflict.externalValue);
  const externalLabel = labelForSource(conflict.externalSource);
  const delta =
    typeof conflict.brokerValue === 'number' &&
    typeof conflict.externalValue === 'number'
      ? Math.abs(conflict.brokerValue - conflict.externalValue)
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="hairline-mid"
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        padding: '20px 22px',
        maxWidth: 720,
      }}
    >
      <div className="eyebrow" style={{ color: 'var(--color-warn)' }}>
        {conflict.fieldPath.split('.').pop()?.toUpperCase()} · CONFLICT
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 14,
          color: 'var(--color-ink-mute)',
          marginTop: 2,
        }}
      >
        {delta !== null
          ? `two sources disagree by £${delta.toLocaleString()}`
          : 'two sources disagree'}
      </div>

      <div
        className="hairline"
        style={{
          marginTop: 16,
          borderRadius: 'var(--radius-card)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1.4fr',
          overflow: 'hidden',
        }}
      >
        {/* Broker voice */}
        <div style={{ padding: '14px 16px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            broker says
          </div>
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 22,
              color: 'var(--color-ink)',
              letterSpacing: '-0.005em',
            }}
          >
            {broker}
          </div>
          <ConflictBlurb mode="broker">
            source: {conflict.brokerSourceRef || 'broker slip'}
          </ConflictBlurb>
        </div>

        {/* External voice — separated by hairlines on both sides */}
        <div
          className="hairline-l hairline-r"
          style={{ padding: '14px 16px' }}
        >
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {externalLabel}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 20,
              color: 'var(--color-ink)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
            }}
          >
            {external}
          </div>
          <ConflictBlurb mode="external">
            {conflict.externalSourceRef}
          </ConflictBlurb>
        </div>

        {/* Underwriter's call */}
        <div style={{ padding: '14px 16px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            underwriter&rsquo;s call
          </div>
          <Radio
            checked={choice === 'broker'}
            onChange={() => setChoice('broker')}
            label="Trust broker"
          />
          <Radio
            checked={choice === 'external'}
            onChange={() => setChoice('external')}
            label={`Trust ${externalLabel.toLowerCase()}`}
          />
          <Radio
            checked={choice === 'custom'}
            onChange={() => setChoice('custom')}
            label="Use a different value"
          />
          {choice === 'custom' && (
            <input
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="enter value"
              className="hairline mono"
              style={{
                marginTop: 4,
                marginLeft: 22,
                width: 'calc(100% - 22px)',
                background: 'var(--color-bg)',
                padding: '4px 8px',
                fontSize: 12,
                color: 'var(--color-ink)',
                borderRadius: 'var(--radius-button)',
              }}
            />
          )}

          <div style={{ marginTop: 12 }}>
            <label
              className="eyebrow"
              htmlFor={`reason-${conflict.id}`}
              style={{ display: 'block', marginBottom: 4 }}
            >
              reason (required)
            </label>
            <textarea
              id={`reason-${conflict.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="for the audit trail."
              className="hairline"
              style={{
                width: '100%',
                resize: 'vertical',
                background: 'var(--color-bg)',
                padding: '6px 10px',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 12.5,
                lineHeight: 1.5,
                color: 'var(--color-ink-soft)',
                borderRadius: 'var(--radius-button)',
              }}
            />
            <div
              className="mono"
              style={{
                fontSize: 9.5,
                color: 'var(--color-ink-faint)',
                letterSpacing: '0.06em',
                marginTop: 2,
              }}
            >
              {reason.trim().length}/8 chars
            </div>
          </div>

          {error && (
            <p
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12,
                color: 'var(--color-danger)',
                margin: '8px 0 0',
              }}
            >
              {error}
            </p>
          )}

          <div style={{ marginTop: 12 }}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResolve}
              disabled={!canSubmit}
            >
              Resolve →
            </Button>
          </div>
        </div>
      </div>

      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--color-ink-faint)',
          marginTop: 12,
          marginBottom: 0,
          maxWidth: '60ch',
          lineHeight: 1.5,
        }}
      >
        {conflict.marginalia}
      </p>
    </motion.div>
  );
}

function ConflictBlurb({
  mode,
  children,
}: {
  mode: 'broker' | 'external';
  children: React.ReactNode;
}) {
  return (
    <div
      className={mode === 'broker' ? 'serif' : 'mono'}
      style={{
        marginTop: 6,
        fontStyle: mode === 'broker' ? 'italic' : 'normal',
        fontSize: mode === 'broker' ? 12 : 10.5,
        color: 'var(--color-ink-faint)',
        letterSpacing: mode === 'broker' ? '-0.005em' : '0.04em',
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  );
}

function Radio({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-2"
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '4px 0',
        fontSize: 13,
        color: checked ? 'var(--color-ink)' : 'var(--color-ink-soft)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          border: `0.5px solid ${
            checked ? 'var(--color-accent)' : 'var(--color-rule-mid)'
          }`,
          background: checked ? 'var(--color-accent)' : 'transparent',
          flex: '0 0 12px',
          display: 'inline-block',
        }}
      />
      <span>{label}</span>
    </button>
  );
}

function parseCustomNumber(raw: string): number | null {
  const cleaned = raw.replace(/[£,_\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function labelForSource(id: string): string {
  switch (id) {
    case 'companies-house':
      return 'Companies House';
    case 'ea-permit-registry':
      return 'EA Permit Registry';
    case 'experian-sanctions':
      return 'Experian Sanctions';
    case 'internal-loss-index':
      return 'Internal Loss Index';
    default:
      return id;
  }
}
