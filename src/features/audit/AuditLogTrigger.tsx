import { History } from 'lucide-react';
import { useRanBerri } from '@/store';

/**
 * The compact icon that opens the full audit log inspector. Lives in
 * the canvas top bar and writes audit.viewed when activated (so the
 * fact that an underwriter consulted the log is itself logged).
 */
export function AuditLogTrigger() {
  const submission = useRanBerri((s) => s.submission);
  const setOpen = useRanBerri((s) => s.setAuditLogOpen);
  const open = useRanBerri((s) => s.ui.auditLogOpen);

  if (!submission) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (!open) {
          useRanBerri.getState().appendAuditEvent({
            actor: { kind: 'underwriter', id: 'nm' },
            kind: 'audit.viewed',
            submissionId: submission.id,
            viewedBy: 'nm',
          });
        }
        setOpen(!open);
      }}
      title="Audit log"
      aria-label="Open audit log"
      className="inline-flex items-center justify-center"
      style={{
        padding: 5,
        borderRadius: 'var(--radius-button)',
        color: open ? 'var(--color-accent)' : 'var(--color-ink-mute)',
        background: open ? 'var(--color-sunken)' : 'transparent',
      }}
    >
      <History size={14} strokeWidth={1.5} />
    </button>
  );
}
