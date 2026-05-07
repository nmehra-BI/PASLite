import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useConfig } from '@/config';
import { useAutonomy } from '@/store/autonomy';
import { useLedger } from '@/store/ledger';
import {
  computeRecallRate,
  queryAutonomyActions,
} from '@/lib/ledger';
import type { DecisionClassId } from '@/lib/autonomy/types';
import { LedgerActionRow } from './LedgerActionRow';
import { LedgerNavStrip } from './LedgerNavStrip';
import { ExportModal } from './ExportModal';
import { RecallModal } from '@/features/autonomy';

const CLASS_LABEL: Record<DecisionClassId, string> = {
  'TRIAGE-AUTO-PASS': 'Auto-pass triage',
  'TRIAGE-AUTO-DECLINE': 'Auto-decline triage',
  'CONFLICT-AUTO-RESOLVE': 'Auto-resolve conflicts',
  'BIND-AUTO-COMMIT': 'Auto-commit bind',
  'NTU-AUTO-CAPTURE': 'Auto-capture NTU',
};

/**
 * Module 15 — class detail view (/ledger/{classId}). Full feed of
 * actions in a class. Reuses the ledger nav strip for filters.
 */
export function LedgerSectionDetail({ classId }: { classId: string }) {
  const filters = useLedger((s) => s.filters);
  const policy = useAutonomy((s) => s.policy);
  const appendAuditEvent = useRanBerri((s) => s.appendAuditEvent);
  const [recallTarget, setRecallTarget] = useState<{
    entryRef: string;
    classId: string;
    recallExpiresAt: string;
  } | null>(null);

  // Treat the route-param classId as the class restriction.
  const all = useMemo(() => queryAutonomyActions(filters, new Date()), [filters]);
  const ofClass = useMemo(
    () => all.filter((a) => a.classId === classId),
    [all, classId],
  );
  const recall = useMemo(() => computeRecallRate(ofClass), [ofClass]);

  const cls = policy.decisionClasses[classId as DecisionClassId];
  const enabled = cls?.enabled ?? false;
  const label = CLASS_LABEL[classId as DecisionClassId] ?? classId;

  useEffect(() => {
    appendAuditEvent({
      actor: { kind: 'underwriter', id: 'nm' },
      kind: 'ledger.viewed',
      viewedBy: 'nm',
      actionCount: ofClass.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  return (
    <div
      style={{
        height: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
      }}
    >
      <Masthead />
      <header
        className="hairline-b"
        style={{
          padding: '24px 36px 18px',
          background: 'var(--color-surface)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/ledger';
          }}
          className="serif inline-flex items-center gap-1"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          <ArrowLeft size={11} strokeWidth={1.5} />
          back to ledger
        </button>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-soft)',
            marginBottom: 2,
            fontWeight: 500,
          }}
        >
          {classId}
        </div>
        <h1
          className="serif"
          style={{
            fontSize: 22,
            fontWeight: 500,
            margin: 0,
            color: 'var(--color-ink)',
            letterSpacing: '-0.012em',
          }}
        >
          {label}
        </h1>
        <p
          className="serif"
          style={{
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            marginTop: 8,
            letterSpacing: '-0.005em',
            lineHeight: 1.55,
          }}
        >
          {ofClass.length} action{ofClass.length === 1 ? '' : 's'} ·{' '}
          recall rate {(recall.rate * 100).toFixed(1)}%
          {recall.recalled > 0 && ` (${recall.recalled} recalled)`}
          {!enabled && ' · class is currently disabled'}
        </p>
      </header>
      <LedgerNavStrip />
      <main style={{ flex: 1 }}>
        {ofClass.length === 0 ? (
          <Empty />
        ) : (
          ofClass.map((a) => (
            <LedgerActionRow
              key={a.id}
              action={a}
              onOpenSubmission={() => {
                window.location.hash = `#/submission/${a.entryRef.toLowerCase()}`;
              }}
              onRecall={() =>
                setRecallTarget({
                  entryRef: a.entryRef,
                  classId: a.classId,
                  recallExpiresAt: a.recallExpiresAt,
                })
              }
            />
          ))
        )}
      </main>
      <Footer />
      <ExportModal />
      {recallTarget && (
        <RecallModal
          entryRef={recallTarget.entryRef}
          classId={recallTarget.classId}
          recallExpiresAt={recallTarget.recallExpiresAt}
          onClose={() => setRecallTarget(null)}
          onRecalled={() => setRecallTarget(null)}
        />
      )}
    </div>
  );
}

function Empty() {
  return (
    <div
      className="serif"
      style={{
        padding: '60px 36px',
        fontStyle: 'italic',
        fontSize: 14,
        color: 'var(--color-ink-mute)',
        textAlign: 'center',
        letterSpacing: '-0.005em',
      }}
    >
      No actions in this class match the current filter.
    </div>
  );
}

function Masthead() {
  const config = useConfig();
  return (
    <div
      className="hairline-b flex items-center justify-between"
      style={{
        height: 44,
        padding: '0 36px',
        background: 'var(--color-surface)',
      }}
    >
      <span
        className="serif"
        style={{
          fontSize: 14.5,
          fontWeight: 500,
          letterSpacing: '-0.018em',
          color: 'var(--color-ink)',
        }}
      >
        {config.branding.productName}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          letterSpacing: '0.06em',
          color: 'var(--color-ink-mute)',
        }}
      >
        autonomy · ledger · class detail
      </span>
    </div>
  );
}

function Footer() {
  return (
    <div
      className="hairline-t"
      style={{ padding: '14px 36px', background: 'var(--color-bg)' }}
    >
      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--color-ink-faint)',
          margin: 0,
          letterSpacing: '-0.005em',
        }}
      >
        the cockpit · autonomy ledger · class detail
      </p>
    </div>
  );
}
