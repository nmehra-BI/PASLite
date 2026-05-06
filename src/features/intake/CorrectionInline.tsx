import { useState } from 'react';
import { useRanBerri } from '@/store';
import { Button } from '@/components';
import type { Field } from '@/lib/field';
import { effectiveValue } from '@/lib/field';

type Props = {
  path: string;
  field: Field<unknown>;
  onSaved?: () => void;
  onCancel?: () => void;
};

/**
 * Inline correction form. Fires `applyCorrection` from the main store,
 * which reads the field at `path`, stamps the underwriter layer, writes
 * it back, walks the dependency graph, invalidates the affected
 * artifacts, and emits the cause + effect audit events.
 *
 * Module 2 ships values typed as plain text (numbers and strings). We
 * coerce on save and only accept the corrected value if it parses to a
 * compatible primitive. Complex Field<T>s (arrays, objects) are
 * read-only in module 2's inspector.
 */
export function CorrectionInline({ path, field, onSaved, onCancel }: Props) {
  const apply = useRanBerri((s) => s.applyCorrection);
  const current = effectiveValue(field);

  const initial = formatPrimitive(current);
  const editable = canEdit(current);
  const [value, setValue] = useState(initial);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    if (!editable) {
      setError('This field is not editable inline in module 2.');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required for any correction.');
      return;
    }
    const parsed = parseAs(value, current);
    if (parsed.kind === 'error') {
      setError(parsed.message);
      return;
    }
    try {
      apply(path, {
        value: parsed.value,
        reason: reason.trim(),
        correctedBy: 'nm',
        correctedAt: new Date().toISOString(),
      });
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div
      className="hairline"
      style={{
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius-card)',
        padding: 14,
      }}
    >
      <Row label="current">
        <span className="serif" style={{ fontSize: 14 }}>
          {initial || '—'}
        </span>
      </Row>
      <Row label="broker stated">
        <span
          className="serif"
          style={{ fontSize: 13, color: 'var(--color-ink-mute)' }}
        >
          {formatPrimitive(field.brokerStated) || '—'}
        </span>
      </Row>

      <div style={{ marginTop: 10, marginBottom: 10 }}>
        <label
          htmlFor="correction-value"
          className="eyebrow"
          style={{ display: 'block', marginBottom: 4 }}
        >
          your correction
        </label>
        <input
          id="correction-value"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!editable}
          className="hairline"
          style={{
            width: '100%',
            background: 'var(--color-surface)',
            padding: '6px 10px',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--color-ink)',
            borderRadius: 'var(--radius-button)',
          }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label
          htmlFor="correction-reason"
          className="eyebrow"
          style={{ display: 'block', marginBottom: 4 }}
        >
          reason (required)
        </label>
        <textarea
          id="correction-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="hairline"
          style={{
            width: '100%',
            resize: 'vertical',
            background: 'var(--color-surface)',
            padding: '6px 10px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--color-ink-soft)',
            borderRadius: 'var(--radius-button)',
          }}
          placeholder="Why does this need correcting?"
        />
      </div>

      {error && (
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--color-danger)',
            margin: '0 0 10px',
          }}
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!editable}>
          Save correction
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3" style={{ paddingBottom: 4 }}>
      <span
        className="mono"
        style={{
          width: 96,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function formatPrimitive(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return '';
}

function canEdit(v: unknown): boolean {
  return (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    v === null
  );
}

type Parsed =
  | { kind: 'ok'; value: unknown }
  | { kind: 'error'; message: string };

function parseAs(raw: string, ref: unknown): Parsed {
  if (typeof ref === 'number') {
    const cleaned = raw.replace(/[£,_\s]/g, '');
    const n = Number(cleaned);
    if (!Number.isFinite(n)) {
      return { kind: 'error', message: 'Enter a valid number.' };
    }
    return { kind: 'ok', value: n };
  }
  if (typeof ref === 'boolean') {
    const lower = raw.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(lower)) return { kind: 'ok', value: true };
    if (['false', 'no', 'n', '0'].includes(lower)) return { kind: 'ok', value: false };
    return { kind: 'error', message: 'Enter true/false (or yes/no).' };
  }
  // strings (default) — empty disallowed
  if (raw.trim() === '') return { kind: 'error', message: 'Value cannot be empty.' };
  return { kind: 'ok', value: raw };
}
