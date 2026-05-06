import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
};

/**
 * Shared modal shell — backdrop + centred panel with a title bar.
 * Closes on ESC or backdrop click.
 */
export function Modal({ title, onClose, children, width = 460 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.18)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
        className="hairline-mid"
        style={{
          width,
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 48px)',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          className="hairline-b flex items-center justify-between"
          style={{ padding: '12px 18px', flex: '0 0 auto' }}
        >
          <span
            className="serif"
            style={{
              fontSize: 14.5,
              fontWeight: 500,
              letterSpacing: '-0.012em',
              color: 'var(--color-ink)',
            }}
          >
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: 4, color: 'var(--color-ink-mute)' }}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div style={{ padding: '16px 18px 20px', overflow: 'auto' }}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

export function Radio({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="flex items-center gap-2"
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '4px 0',
        fontSize: 13,
        color: disabled
          ? 'var(--color-ink-faint)'
          : checked
            ? 'var(--color-ink)'
            : 'var(--color-ink-soft)',
        cursor: disabled ? 'default' : 'pointer',
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

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
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
        color: 'var(--color-ink-soft)',
      }}
    >
      <span
        aria-hidden
        className="hairline-mid"
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          background: checked ? 'var(--color-ink)' : 'transparent',
          flex: '0 0 12px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-bg)',
          fontSize: 9,
          lineHeight: 1,
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span>{label}</span>
    </button>
  );
}
