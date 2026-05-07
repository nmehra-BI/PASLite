import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAutonomy } from '@/store/autonomy';
import { InspectorChrome } from '@/components/inspector';
import { RecallModal } from './RecallModal';

/**
 * Module 14 — drawer that explains a single autonomous action.
 *
 * Provenance: which class fired, which conditions matched, AI
 * confidence, the policy version in effect, and the recall affordance
 * if the action is still inside its window.
 */
export function AutonomyInspector({
  entryRef,
  onClose,
}: {
  entryRef: string;
  onClose: () => void;
}) {
  const fired = useAutonomy((s) => s.firedByRef[entryRef]);
  const [recallOpen, setRecallOpen] = useState(false);

  if (!fired) {
    return (
      <DrawerShell onClose={onClose}>
        <InspectorChrome
          breadcrumb="autonomy · inspector"
          title="No autonomous action"
          subtitle="This submission was not actioned by the cockpit autonomously."
          onClose={onClose}
        >
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-ink-mute)',
              padding: '8px 0',
              letterSpacing: '-0.005em',
            }}
          >
            Open this drawer from a row that displays an autonomy indicator
            (⚡) to see the provenance.
          </div>
        </InspectorChrome>
      </DrawerShell>
    );
  }

  const expiresAt = new Date(fired.recallExpiresAt);
  const expired = expiresAt.getTime() < Date.now();
  const recalled = fired.recalled;

  return (
    <DrawerShell onClose={onClose}>
      <InspectorChrome
        breadcrumb={`autonomy · ${fired.classId}`}
        title={`${fired.action.toUpperCase()} fired autonomously`}
        subtitle={`${entryRef} · policy ${fired.policyVersion} · confidence ${(fired.confidence * 100).toFixed(0)}%`}
        onClose={onClose}
      >
        <Section title="Class">
          <KV label="decision class">{fired.classId}</KV>
          <KV label="action">{fired.action.toUpperCase()}</KV>
          <KV label="fired by">{fired.byAi}</KV>
          <KV label="fired at">
            {new Date(fired.firedAt).toLocaleString('en-GB')}
          </KV>
        </Section>

        <Section title="Conditions met">
          <ul
            className="serif"
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13,
              color: 'var(--color-ink)',
              lineHeight: 1.6,
              letterSpacing: '-0.005em',
            }}
          >
            {fired.conditionsMet.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>

        <Section title="Recall window">
          <p
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--color-ink-mute)',
              margin: '0 0 10px',
              lineHeight: 1.55,
              letterSpacing: '-0.005em',
            }}
          >
            {recalled
              ? `Recalled ${fired.recalledAt ? new Date(fired.recalledAt).toLocaleString('en-GB') : ''} — ${fired.recallReason ?? '—'}.`
              : expired
                ? `The recall window closed at ${expiresAt.toLocaleString('en-GB')}. This action is now binding.`
                : `You have until ${expiresAt.toLocaleString('en-GB')} to reverse this. After that, the decision becomes binding.`}
          </p>
          {!recalled && !expired && (
            <button
              type="button"
              onClick={() => setRecallOpen(true)}
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                padding: '4px 12px',
                borderRadius: 'var(--radius-button)',
                border: '0.5px solid var(--color-accent)',
                background: 'transparent',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                letterSpacing: '-0.005em',
              }}
            >
              Recall &amp; override
            </button>
          )}
        </Section>
      </InspectorChrome>

      {recallOpen && (
        <RecallModal
          entryRef={entryRef}
          classId={fired.classId}
          recallExpiresAt={fired.recallExpiresAt}
          onClose={() => setRecallOpen(false)}
          onRecalled={() => {
            setRecallOpen(false);
          }}
        />
      )}
    </DrawerShell>
  );
}

function DrawerShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.18)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
      }}
    >
      <motion.aside
        initial={{ x: 16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 16, opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="hairline-l"
        style={{
          width: 520,
          maxWidth: '100vw',
          background: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {children}
      </motion.aside>
    </motion.div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 18 }}>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline" style={{ gap: 12 }}>
      <span
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          minWidth: 110,
        }}
      >
        {label}
      </span>
      <span
        className="serif"
        style={{
          fontSize: 13,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
        }}
      >
        {children}
      </span>
    </div>
  );
}
