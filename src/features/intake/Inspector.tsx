import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Pencil, X } from 'lucide-react';
import { useRanBerri } from '@/store';
import { ConfidenceDot, SourceRef } from '@/components';
import { effectiveValue, type Field } from '@/lib/field';
import { getAtPath } from '@/lib/paths';
import { isField } from '@/lib/deps';
import { useIntake } from './intakeStore';
import { CorrectionInline } from './CorrectionInline';

/**
 * The inspector slides in from the right edge of the canvas body when
 * a field is opened. It shows the full Field<T> detail (broker layer,
 * system layer, optional underwriter layer) plus a "correct this"
 * affordance.
 *
 * Closes on click-outside, ESC, or the X button.
 */
export function Inspector() {
  const path = useIntake((s) => s.inspectorFieldPath);
  const close = useIntake((s) => s.closeInspector);
  const submission = useRanBerri((s) => s.submission);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!path) {
      setEditing(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [path, close]);

  const field = path && submission ? (getAtPath(submission, path) as unknown) : null;
  const isAField = isField(field);

  return (
    <AnimatePresence>
      {path && isAField && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
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
            <Header path={path} onClose={close} onEdit={() => setEditing((e) => !e)} editing={editing} />
            <Body
              path={path}
              field={field as Field<unknown>}
              editing={editing}
              onSaved={() => {
                setEditing(false);
                close();
              }}
              onCancel={() => setEditing(false)}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Header({
  path,
  onClose,
  onEdit,
  editing,
}: {
  path: string;
  onClose: () => void;
  onEdit: () => void;
  editing: boolean;
}) {
  return (
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
          inspector
        </span>
        <ChevronRight
          size={11}
          strokeWidth={1.5}
          style={{ color: 'var(--color-ink-faint)' }}
        />
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--color-ink)' }}
        >
          {path}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Correct this field"
          className="inline-flex items-center gap-1"
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-button)',
            color: editing ? 'var(--color-accent)' : 'var(--color-ink-mute)',
            fontSize: 11.5,
          }}
        >
          <Pencil size={12} strokeWidth={1.5} />
          <span>correct this</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          style={{
            padding: 4,
            color: 'var(--color-ink-mute)',
          }}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

function Body({
  path,
  field,
  editing,
  onSaved,
  onCancel,
}: {
  path: string;
  field: Field<unknown>;
  editing: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const value = effectiveValue(field);
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
      <div
        className="serif"
        style={{
          fontSize: 22,
          fontWeight: 400,
          letterSpacing: '-0.012em',
          color: 'var(--color-ink)',
          lineHeight: 1.2,
        }}
      >
        {formatPretty(value)}
      </div>

      <div style={{ height: 14 }} />

      <Layer label="broker stated" tone="quiet">
        <span style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
          {formatPretty(field.brokerStated) || <em>not stated</em>}
        </span>
      </Layer>

      <Layer label="system extracted">
        {field.systemExtracted ? (
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--color-ink)' }}>
              {formatPretty(field.systemExtracted.value)}
            </span>
            <ConfidenceDot confidence={field.systemExtracted.confidence} />
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--color-ink-mute)',
                letterSpacing: '0.04em',
              }}
            >
              conf {(field.systemExtracted.confidence * 100).toFixed(0)}%
            </span>
            <SourceRef
              sourceRef={field.systemExtracted.sourceRef}
              modelVersion={field.systemExtracted.modelVersion}
              extractedAt={field.systemExtracted.extractedAt}
            />
          </div>
        ) : (
          <em style={{ color: 'var(--color-ink-faint)' }}>not extracted</em>
        )}
      </Layer>

      <Layer label="underwriter corrected" tone={field.underwriterCorrected ? 'accent' : 'quiet'}>
        {field.underwriterCorrected ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-ink)' }}>
              {formatPretty(field.underwriterCorrected.value)}
            </div>
            <div
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12,
                color: 'var(--color-ink-mute)',
                marginTop: 4,
              }}
            >
              &ldquo;{field.underwriterCorrected.reason}&rdquo;
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--color-ink-faint)',
                letterSpacing: '0.04em',
                marginTop: 4,
              }}
            >
              {field.underwriterCorrected.correctedBy} ·{' '}
              {new Date(field.underwriterCorrected.correctedAt).toLocaleString('en-GB')}
            </div>
          </div>
        ) : (
          <em style={{ color: 'var(--color-ink-faint)' }}>no correction yet</em>
        )}
      </Layer>

      {editing && (
        <div style={{ marginTop: 16 }}>
          <CorrectionInline
            path={path}
            field={field}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        </div>
      )}
    </div>
  );
}

function Layer({
  label,
  tone = 'default',
  children,
}: {
  label: string;
  tone?: 'default' | 'quiet' | 'accent';
  children: React.ReactNode;
}) {
  const fg =
    tone === 'accent'
      ? 'var(--color-accent)'
      : tone === 'quiet'
        ? 'var(--color-ink-faint)'
        : 'var(--color-ink-mute)';
  return (
    <div className="hairline-t" style={{ padding: '10px 0' }}>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: fg,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function formatPretty(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.join(', ');
  return JSON.stringify(v);
}
