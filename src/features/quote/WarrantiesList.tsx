import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useReadOnly } from '@/lib/readOnly';
import { EditableField } from './EditableField';

type Props = {
  /** Default warranties derived from submission state. */
  defaults: string[];
};

const ROMAN = ['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.', 'vii.', 'viii.'];

/**
 * Italic-serif numbered warranties. Each warranty is editable; the
 * "+ Add warranty" affordance appends a new one (also editable).
 */
export function WarrantiesList({ defaults }: Props) {
  const slipEdits = useRanBerri((s) => s.quote.slipEdits);
  const editAction = useRanBerri((s) => s.editSlipField);
  const readOnly = useReadOnly();

  const warranties = useMemo(() => {
    // Count: max(defaults.length, max edited warranty index + 1)
    let count = defaults.length;
    for (const k of Object.keys(slipEdits)) {
      const m = k.match(/^warranty\.(\d+)$/);
      if (m) count = Math.max(count, Number(m[1]) + 1);
    }
    return Array.from({ length: count }, (_, i) => ({
      key: `warranty.${i}`,
      defaultValue: defaults[i] ?? '',
    }));
  }, [defaults, slipEdits]);

  const addWarranty = () => {
    const nextIdx = warranties.length;
    editAction({
      fieldKey: `warranty.${nextIdx}`,
      previousValue: '',
      nextValue: 'New warranty — click to edit.',
      editedBy: 'nm',
    });
  };

  return (
    <ol
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {warranties.map((w, i) => (
        <li
          key={w.key}
          className="serif"
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr',
            gap: 8,
            fontStyle: 'italic',
            fontSize: 14,
            lineHeight: 1.55,
            color: 'var(--color-ink-soft)',
          }}
        >
          <span
            style={{
              color: 'var(--color-ink-mute)',
              textAlign: 'right',
            }}
          >
            {ROMAN[i] ?? `${i + 1}.`}
          </span>
          <EditableField
            fieldKey={w.key}
            defaultValue={w.defaultValue}
            italic
            multiline
          />
        </li>
      ))}
      {!readOnly && (
        <li
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr',
            gap: 8,
            marginTop: 4,
          }}
        >
          <span />
          <button
            type="button"
            onClick={addWarranty}
            className="serif inline-flex items-center gap-1.5"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-accent)',
              padding: 0,
              alignSelf: 'flex-start',
            }}
          >
            <Plus size={11} strokeWidth={1.5} />
            Add warranty
          </button>
        </li>
      )}
    </ol>
  );
}
