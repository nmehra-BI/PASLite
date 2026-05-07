import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownUp } from 'lucide-react';
import { useRanBerri } from '@/store';
import { InspectorChrome } from '@/components/inspector';
import { AuditFilters, eventMatchesFilter, type AuditFilterKey } from './AuditFilters';
import { AuditEventRow } from './AuditEventRow';

/**
 * The full chronological audit log view. Opens as a side panel from
 * the canvas top bar OR from the decision trail's "see all events →"
 * link (module 13). Standardised chrome via InspectorChrome.
 */
export function AuditLogInspector() {
  const open = useRanBerri((s) => s.ui.auditLogOpen);
  const setOpen = useRanBerri((s) => s.setAuditLogOpen);
  const log = useRanBerri((s) => s.auditLog);
  const submission = useRanBerri((s) => s.submission);
  const bind = useRanBerri((s) => s.bind);
  const [filter, setFilter] = useState<AuditFilterKey>('all');
  const [sortDesc, setSortDesc] = useState(true);

  const filtered = useMemo(() => {
    const out = log.filter((e) => eventMatchesFilter(e.kind, filter));
    return sortDesc ? [...out].reverse() : out;
  }, [log, filter, sortDesc]);

  if (!open || !submission) return null;

  const policyRef = bind.policyRef ?? submission.id;

  function exportLog() {
    if (!submission) return;
    const json = JSON.stringify(log, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${policyRef.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'audit.exported',
      submissionId: submission.id,
      exportedBy: 'nm',
      eventCount: log.length,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Audit log"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.18)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
      }}
    >
      <motion.aside
        initial={{ x: 16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="hairline-l"
        style={{
          width: 620,
          maxWidth: '100vw',
          background: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <InspectorChrome
          breadcrumb={`AUDIT · ${policyRef}`}
          title="Full event chronology"
          subtitle={`${log.length} events · canonical persistence form`}
          onClose={() => setOpen(false)}
          onExport={exportLog}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 0 10px',
            }}
          >
            <AuditFilters active={filter} onChange={setFilter} />
            <button
              type="button"
              onClick={() => setSortDesc((v) => !v)}
              title={sortDesc ? 'Newest first' : 'Oldest first'}
              className="mono inline-flex items-center gap-1"
              style={{
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '3px 9px',
                borderRadius: 'var(--radius-pill)',
                border: '0.5px solid var(--color-rule-mid)',
                color: 'var(--color-ink-mute)',
                background: 'transparent',
              }}
            >
              <ArrowDownUp size={9} strokeWidth={1.5} />
              {sortDesc ? 'newest' : 'oldest'}
            </button>
          </div>

          {filtered.length === 0 ? (
            <p
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                color: 'var(--color-ink-faint)',
                lineHeight: 1.55,
              }}
            >
              No events match this filter.
            </p>
          ) : (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filtered.map((e) => (
                <AuditEventRow key={e.id} event={e} />
              ))}
            </ol>
          )}
        </InspectorChrome>
      </motion.aside>
    </motion.div>
  );
}
