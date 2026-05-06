import { useEffect, useRef, useState } from 'react';
import { useRanBerri } from '@/store';
import { useReadOnly } from '@/lib/readOnly';

type Props = {
  fieldKey: string;
  defaultValue: string;
  italic?: boolean;
  multiline?: boolean;
  /** Force the live value, used when the source value has changed. */
  liveValue?: string;
};

/**
 * Inline content-editable text. On hover: hairline underline appears.
 * On click: enters edit mode. On blur or Enter: emits `slip.fieldEdited`.
 *
 * Read from the audit-derived `quote.slipEdits[fieldKey]` if present;
 * fall back to `defaultValue` (which itself is derived from submission
 * state). After save: a small coral dot appears for 30s next to the
 * field, then fades.
 */
export function EditableField({
  fieldKey,
  defaultValue,
  italic = false,
  multiline = false,
  liveValue,
}: Props) {
  const editRecord = useRanBerri((s) => s.quote.slipEdits[fieldKey]);
  const editAction = useRanBerri((s) => s.editSlipField);
  const readOnly = useReadOnly();
  const ref = useRef<HTMLSpanElement>(null);
  const [showDot, setShowDot] = useState(false);

  const persistedValue = editRecord?.value ?? liveValue ?? defaultValue;

  // Show coral "edited" dot for 30s after each save.
  useEffect(() => {
    if (!editRecord) return;
    const since = Date.now() - new Date(editRecord.editedAt).getTime();
    if (since > 30_000) return;
    setShowDot(true);
    const t = setTimeout(() => setShowDot(false), 30_000 - since);
    return () => clearTimeout(t);
  }, [editRecord?.editedAt]);

  const commit = () => {
    if (!ref.current) return;
    const next = (
      multiline
        ? ref.current.innerText
        : ref.current.textContent ?? ''
    ).trim();
    if (next === persistedValue) return;
    editAction({
      fieldKey,
      previousValue: persistedValue,
      nextValue: next,
      editedBy: 'nm',
    });
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        position: 'relative',
      }}
    >
      <span
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={(e) => {
          if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
          if (e.key === 'Escape') {
            (e.currentTarget as HTMLElement).blur();
          }
        }}
        title={
          editRecord
            ? `edited ${new Date(editRecord.editedAt).toLocaleString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })} by ${editRecord.editedBy} · was: ${defaultValue}`
            : undefined
        }
        className="editable-slip-field"
        style={{
          outline: 'none',
          fontStyle: italic ? 'italic' : 'normal',
          cursor: readOnly ? 'default' : 'text',
          padding: 0,
          color: 'inherit',
        }}
      >
        {persistedValue}
      </span>
      {showDot && (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 4,
            height: 4,
            borderRadius: 999,
            background: 'var(--color-accent)',
            transform: 'translateY(-4px)',
          }}
        />
      )}
    </span>
  );
}
