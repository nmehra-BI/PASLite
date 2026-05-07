import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader } from 'lucide-react';
import { useLedger } from '@/store/ledger';
import { useAutonomy } from '@/store/autonomy';
import { generateReport, getAllAutonomyActions } from '@/lib/ledger';
import type { DecisionClassId } from '@/lib/autonomy/types';
import { ExportPreview } from './ExportPreview';

const ALL_CLASSES: DecisionClassId[] = [
  'TRIAGE-AUTO-PASS',
  'TRIAGE-AUTO-DECLINE',
  'CONFLICT-AUTO-RESOLVE',
  'BIND-AUTO-COMMIT',
  'NTU-AUTO-CAPTURE',
];

const PERIOD_OPTIONS = [
  { kind: 'last-7-days' as const, label: 'Last 7 days' },
  { kind: 'last-30-days' as const, label: 'Last 30 days' },
  {
    kind: 'last-calendar-month' as const,
    label: `Last calendar month (${calendarMonthLabel(new Date())})`,
  },
];

function calendarMonthLabel(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/**
 * Module 15 — export configuration + generation modal. Three phases:
 *   configure → preparing (2s cinematic) → ready (preview)
 */
export function ExportModal() {
  const open = useLedger((s) => s.exportModalOpen);
  const phase = useLedger((s) => s.exportPhase);
  const draft = useLedger((s) => s.exportDraft);
  const close = useLedger((s) => s.closeExport);
  const setPeriod = useLedger((s) => s.setExportPeriod);
  const setFormat = useLedger((s) => s.setExportFormat);
  const setRecipient = useLedger((s) => s.setExportRecipient);
  const toggleClass = useLedger((s) => s.toggleExportClass);
  const setPhase = useLedger((s) => s.setExportPhase);
  const setReport = useLedger((s) => s.setGeneratedReport);
  const setExportSent = useLedger((s) => s.setExportSent);
  const policy = useAutonomy((s) => s.policy);

  // Reset sent banner when the modal closes.
  useEffect(() => {
    if (!open) setExportSent(null);
  }, [open, setExportSent]);

  function startGenerate() {
    setPhase('preparing');
    // 2-second cinematic to signal "preparing the bordereau".
    window.setTimeout(() => {
      const all = getAllAutonomyActions();
      const report = generateReport(all, draft, new Date());
      setReport(report);
      setPhase('ready');
    }, 2000);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={close}
          role="dialog"
          aria-label="Export autonomy report"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(31, 30, 29, 0.18)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="hairline"
            style={{
              width: 560,
              maxWidth: '92vw',
              maxHeight: '88vh',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-card)',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <header
              className="flex items-baseline justify-between"
              style={{ marginBottom: 14, flex: '0 0 auto' }}
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
                  export · capacity provider
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
                  Export autonomy report
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
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

            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {phase === 'configure' && (
                <ConfigureStep
                  draft={draft}
                  policy={policy.decisionClasses}
                  setPeriod={setPeriod}
                  setFormat={setFormat}
                  setRecipient={setRecipient}
                  toggleClass={toggleClass}
                />
              )}
              {phase === 'preparing' && <PreparingStep />}
              {phase === 'ready' && <ExportPreview />}
            </div>

            {phase === 'configure' && (
              <footer
                className="hairline-t flex items-center justify-end"
                style={{ paddingTop: 12, marginTop: 12, gap: 8 }}
              >
                <button
                  type="button"
                  onClick={close}
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
                  onClick={startGenerate}
                  disabled={draft.classes.length === 0}
                  className="serif"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 12.5,
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-button)',
                    border: '0.5px solid var(--color-accent)',
                    background:
                      draft.classes.length === 0
                        ? 'var(--color-rule-mid)'
                        : 'var(--color-accent)',
                    color: 'var(--color-bg)',
                    cursor: draft.classes.length === 0 ? 'not-allowed' : 'pointer',
                    letterSpacing: '-0.005em',
                  }}
                >
                  Generate report →
                </button>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ConfigureStep({
  draft,
  policy,
  setPeriod,
  setFormat,
  setRecipient,
  toggleClass,
}: {
  draft: ReturnType<typeof useLedger.getState>['exportDraft'];
  policy: ReturnType<typeof useAutonomy.getState>['policy']['decisionClasses'];
  setPeriod: ReturnType<typeof useLedger.getState>['setExportPeriod'];
  setFormat: ReturnType<typeof useLedger.getState>['setExportFormat'];
  setRecipient: ReturnType<typeof useLedger.getState>['setExportRecipient'];
  toggleClass: ReturnType<typeof useLedger.getState>['toggleExportClass'];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Group label="Date range">
        {PERIOD_OPTIONS.map((opt) => (
          <Radio
            key={opt.kind}
            checked={draft.period.kind === opt.kind}
            onChange={() => setPeriod({ kind: opt.kind })}
          >
            {opt.label}
          </Radio>
        ))}
      </Group>

      <Group label="Decision classes">
        {ALL_CLASSES.map((id) => {
          const cls = policy[id];
          return (
            <Checkbox
              key={id}
              checked={draft.classes.includes(id)}
              onChange={() => toggleClass(id)}
            >
              {id}
              {cls && !cls.enabled && (
                <span
                  className="serif"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 11.5,
                    color: 'var(--color-ink-faint)',
                    marginLeft: 8,
                  }}
                >
                  (currently disabled)
                </span>
              )}
            </Checkbox>
          );
        })}
      </Group>

      <Group label="Format">
        <Radio
          checked={draft.format === 'csv'}
          onChange={() => setFormat('csv')}
        >
          Lloyd&rsquo;s bordereau-style (CSV)
        </Radio>
        <Radio
          checked={draft.format === 'json'}
          onChange={() => setFormat('json')}
        >
          Anthropic-friendly JSON
        </Radio>
      </Group>

      <Group label="Recipient">
        <Radio
          checked={draft.recipient === 'capacity-provider'}
          onChange={() => setRecipient('capacity-provider')}
        >
          Syndicate 2358 (capacity provider)
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--color-ink-mute)',
              letterSpacing: '0.04em',
              marginTop: 2,
            }}
          >
            report-recipient@2358.lloyd.com
          </div>
        </Radio>
        <Radio
          checked={draft.recipient === 'mga-archive'}
          onChange={() => setRecipient('mga-archive')}
        >
          Internal MGA archive
        </Radio>
        <Radio
          checked={draft.recipient === 'download'}
          onChange={() => setRecipient('download')}
        >
          Download only
        </Radio>
      </Group>

      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--color-ink-mute)',
          margin: '4px 0 0',
          lineHeight: 1.55,
          letterSpacing: '-0.005em',
        }}
      >
        Reports include only the actions within Syndicate 2358&rsquo;s authority.
        Other capacity providers&rsquo; actions are filtered automatically.
      </p>
    </div>
  );
}

function PreparingStep() {
  return (
    <div
      style={{
        padding: '40px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
      }}
    >
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, ease: 'linear', repeat: Infinity }}
        style={{ display: 'inline-flex', color: 'var(--color-accent)' }}
      >
        <Loader size={20} strokeWidth={1.5} />
      </motion.span>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
        }}
      >
        preparing report
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--color-ink-mute)',
          letterSpacing: '-0.005em',
        }}
      >
        Walking the audit log, computing chain hash, building bordereau&hellip;
      </div>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function Radio({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className="serif"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: 13,
        color: 'var(--color-ink)',
        letterSpacing: '-0.005em',
        cursor: 'pointer',
        lineHeight: 1.45,
      }}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        style={{ marginTop: 4, accentColor: 'var(--color-accent)' }}
      />
      <span>{children}</span>
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className="mono"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        letterSpacing: '0.04em',
        color: 'var(--color-ink)',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: 'var(--color-accent)' }}
      />
      <span>{children}</span>
    </label>
  );
}
