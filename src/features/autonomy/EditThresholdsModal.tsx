import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useAutonomy } from '@/store/autonomy';
import type {
  ConditionSet,
  DecisionClassConfig,
} from '@/lib/autonomy/types';

type EditableKey =
  | 'confidenceMin'
  | 'premiumRangeMax'
  | 'capacityConsumptionMax'
  | 'profileMatchMin'
  | 'lossesAvgMax'
  | 'brokerHistoryMin';

const FIELDS: Array<{
  key: EditableKey;
  label: string;
  unit: 'pct' | 'gbp' | 'count';
  step: number;
  min?: number;
  max?: number;
}> = [
  { key: 'confidenceMin', label: 'AI confidence (min)', unit: 'pct', step: 0.01, min: 0, max: 1 },
  { key: 'premiumRangeMax', label: 'Premium (max £)', unit: 'gbp', step: 1000, min: 0 },
  { key: 'capacityConsumptionMax', label: 'Capacity consumption (max)', unit: 'pct', step: 0.01, min: 0, max: 1 },
  { key: 'profileMatchMin', label: 'Profile match (min binders)', unit: 'count', step: 1, min: 0 },
  { key: 'lossesAvgMax', label: 'Cohort avg loss ratio (max)', unit: 'pct', step: 0.01, min: 0, max: 2 },
  { key: 'brokerHistoryMin', label: 'Broker history (min subs)', unit: 'count', step: 1, min: 0 },
];

/**
 * Module 14 — edit thresholds modal.
 *
 * Mutates the live decision-class mustMatch band. On save we emit a
 * policyConfigured audit event with a per-field {from,to} diff and
 * delegate the store update to useAutonomy.updateClass — which bumps
 * the policy version atomically.
 */
export function EditThresholdsModal({
  cls,
  onClose,
}: {
  cls: DecisionClassConfig;
  onClose: () => void;
}) {
  const updateClass = useAutonomy((s) => s.updateClass);
  const policyVersion = useAutonomy((s) => s.policy.version);
  const appendAuditEvent = useRanBerri((s) => s.appendAuditEvent);
  const [draft, setDraft] = useState<ConditionSet>(() => ({
    ...cls.autonomyBands.mustMatch,
  }));

  const original = cls.autonomyBands.mustMatch;
  const visibleFields = FIELDS.filter((f) => original[f.key] !== undefined);

  function setVal(key: EditableKey, raw: string) {
    const num = raw === '' ? undefined : Number(raw);
    setDraft((d) => ({ ...d, [key]: num }));
  }

  function save() {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of visibleFields) {
      const before = original[f.key];
      const after = draft[f.key];
      if (before !== after) diff[f.key] = { from: before, to: after };
    }
    if (Object.keys(diff).length === 0) {
      onClose();
      return;
    }
    updateClass(
      cls.id,
      { autonomyBands: { ...cls.autonomyBands, mustMatch: draft } },
      'nm',
    );
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'autonomy.policyConfigured',
      classId: cls.id,
      policyVersion,
      diff,
      configuredBy: 'nm',
    });
    onClose();
  }

  function fmt(value: number | undefined, unit: 'pct' | 'gbp' | 'count'): string {
    if (value === undefined) return '';
    if (unit === 'pct') return value.toFixed(2);
    return String(value);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
      role="dialog"
      aria-label={`Edit ${cls.id} thresholds`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.18)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="hairline"
        style={{
          width: 520,
          maxWidth: '92vw',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 22px',
        }}
      >
        <header
          className="flex items-baseline justify-between"
          style={{ marginBottom: 14 }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-faint)',
              }}
            >
              edit · {cls.id}
            </div>
            <h3
              className="serif"
              style={{
                fontSize: 18,
                fontWeight: 500,
                margin: '4px 0 0',
                color: 'var(--color-ink)',
                letterSpacing: '-0.012em',
              }}
            >
              Adjust autonomy bands
            </h3>
            <p
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                color: 'var(--color-ink-mute)',
                margin: '4px 0 0',
                letterSpacing: '-0.005em',
              }}
            >
              Saving bumps the policy version and writes an audit event with
              the per-field diff.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibleFields.map((f) => (
            <div key={f.key}>
              <label
                className="mono"
                style={{
                  display: 'block',
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-faint)',
                  marginBottom: 4,
                }}
              >
                {f.label}
              </label>
              <input
                type="number"
                value={fmt(draft[f.key], f.unit)}
                step={f.step}
                min={f.min}
                max={f.max}
                onChange={(e) => setVal(f.key, e.target.value)}
                className="mono"
                style={{
                  width: '100%',
                  fontSize: 13,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-button)',
                  border: '0.5px solid var(--color-rule-mid)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-ink)',
                  letterSpacing: '0.04em',
                }}
              />
              <div
                className="serif"
                style={{
                  fontStyle: 'italic',
                  fontSize: 11.5,
                  color: 'var(--color-ink-faint)',
                  marginTop: 2,
                  letterSpacing: '-0.005em',
                }}
              >
                was{' '}
                <span className="mono" style={{ letterSpacing: '0.04em' }}>
                  {fmt(original[f.key], f.unit)}
                </span>
              </div>
            </div>
          ))}
          {visibleFields.length === 0 && (
            <p
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 13,
                color: 'var(--color-ink-mute)',
                margin: 0,
                letterSpacing: '-0.005em',
              }}
            >
              No editable thresholds for this class. Boolean conditions are
              policy-immutable.
            </p>
          )}
        </div>

        <footer
          className="hairline-t flex items-center justify-end"
          style={{ marginTop: 16, paddingTop: 12, gap: 8 }}
        >
          <button
            type="button"
            onClick={onClose}
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '4px 12px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-rule-mid)',
              background: 'transparent',
              color: 'var(--color-ink-mute)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '4px 12px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-accent)',
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            Save &amp; bump version
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
