import { AnimatePresence, motion } from 'framer-motion';
import { FileText, Loader2, Mail, Paperclip } from 'lucide-react';
import { GREENLINE_EMAIL, GREENLINE_SLIP } from '@/lib/fixtures';
import { useIntake } from './intakeStore';

/**
 * The left column during intake. Renders a styled preview of the
 * broker email + the ACORD slip pages. During extraction, the line
 * cited by the current source ref highlights briefly with warn-bg.
 */
export function SourceDocPreview() {
  const phase = useIntake((s) => s.phase);
  const slipPage = useIntake((s) => s.slipPage);
  const highlight = useIntake((s) => s.highlightedSourceRef);

  const highlightLine = lineFromSourceRef(highlight);
  const page = GREENLINE_SLIP.find((p) => p.page === slipPage) ?? GREENLINE_SLIP[0]!;
  const reading = phase === 'reading';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '24px 24px',
        overflow: 'auto',
        height: '100%',
      }}
    >
      <EmailCard />
      <div
        className="hairline-mid"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          flex: '0 0 auto',
        }}
      >
        <div
          className="hairline-b flex items-center justify-between"
          style={{ padding: '10px 14px', background: 'var(--color-bg)' }}
        >
          <div className="flex items-center gap-2">
            <FileText size={13} strokeWidth={1.5} style={{ color: 'var(--color-ink-mute)' }} />
            <span
              className="serif"
              style={{
                fontSize: 12.5,
                fontStyle: 'italic',
                color: 'var(--color-ink-soft)',
              }}
            >
              greenline-acord.pdf
            </span>
            {reading && (
              <Loader2
                size={12}
                strokeWidth={1.5}
                className="animate-spin"
                style={{ color: 'var(--color-accent)' }}
              />
            )}
          </div>
          <div
            className="mono flex items-center gap-1"
            style={{ fontSize: 10, color: 'var(--color-ink-faint)', letterSpacing: '0.06em' }}
          >
            <span>page</span>
            {GREENLINE_SLIP.map((p) => (
              <span
                key={p.page}
                style={{
                  width: 16,
                  textAlign: 'center',
                  color: p.page === slipPage ? 'var(--color-ink)' : 'var(--color-ink-faint)',
                  fontWeight: p.page === slipPage ? 500 : 400,
                }}
              >
                {p.page}
              </span>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={page.page}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            style={{
              padding: '18px 22px',
              background: 'var(--color-surface)',
            }}
          >
            <div
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                color: 'var(--color-ink-mute)',
                marginBottom: 10,
              }}
            >
              {page.heading}
            </div>
            <div
              className="serif"
              style={{
                fontSize: 13.5,
                lineHeight: 1.7,
                color: 'var(--color-ink-soft)',
                letterSpacing: '-0.005em',
              }}
            >
              {page.lines.map((ln) => {
                const isHighlight = highlightLine === ln.line;
                return (
                  <div
                    key={ln.line}
                    style={{
                      display: 'flex',
                      gap: 14,
                      padding: '1px 4px',
                      background: isHighlight ? 'var(--color-warn-bg)' : 'transparent',
                      transition: 'background 220ms cubic-bezier(0.4,0,0.2,1)',
                      borderRadius: 2,
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        width: 18,
                        flex: '0 0 18px',
                        color: 'var(--color-ink-faint)',
                        fontSize: 10.5,
                        textAlign: 'right',
                        paddingTop: 3,
                        letterSpacing: '0.04em',
                      }}
                    >
                      {ln.line}
                    </span>
                    <span
                      style={{
                        color: ln.emphasis ? 'var(--color-ink)' : 'var(--color-ink-soft)',
                      }}
                    >
                      {ln.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmailCard() {
  const date = new Date(GREENLINE_EMAIL.date);
  const stamp = `${date.getDate()} ${date.toLocaleString('en-GB', { month: 'short' })} · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return (
    <div
      className="hairline-mid"
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
    >
      <div
        className="hairline-b flex items-center justify-between"
        style={{ padding: '10px 14px', background: 'var(--color-bg)' }}
      >
        <div className="flex items-center gap-2">
          <Mail size={13} strokeWidth={1.5} style={{ color: 'var(--color-ink-mute)' }} />
          <span
            className="serif"
            style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--color-ink-soft)' }}
          >
            broker email
          </span>
        </div>
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--color-ink-faint)', letterSpacing: '0.06em' }}
        >
          {stamp}
        </span>
      </div>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ marginBottom: 10 }}>
          <Row label="from" value={`${GREENLINE_EMAIL.fromName} <${GREENLINE_EMAIL.from}>`} />
          <Row label="to" value={GREENLINE_EMAIL.to} />
          <Row label="subject" value={GREENLINE_EMAIL.subject} bold />
        </div>
        <p
          className="serif"
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--color-ink-soft)',
            margin: 0,
          }}
        >
          {GREENLINE_EMAIL.body}
        </p>
        <div
          className="hairline-t"
          style={{ marginTop: 14, paddingTop: 10 }}
        >
          <div className="eyebrow mb-2">attachments</div>
          {GREENLINE_EMAIL.attachments.map((a) => (
            <div
              key={a.filename}
              className="flex items-center gap-2"
              style={{ padding: '3px 0', fontSize: 12, color: 'var(--color-ink-soft)' }}
            >
              <Paperclip size={11} strokeWidth={1.5} style={{ color: 'var(--color-ink-faint)' }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--color-ink)' }}>
                {a.filename}
              </span>
              <span style={{ color: 'var(--color-ink-mute)' }}>·</span>
              <span style={{ color: 'var(--color-ink-mute)' }}>{a.description}</span>
              {a.pages && (
                <span className="mono" style={{ fontSize: 10, color: 'var(--color-ink-faint)' }}>
                  {a.pages}p
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline gap-3" style={{ paddingBottom: 2 }}>
      <span
        className="mono"
        style={{
          width: 56,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: 'var(--color-ink)',
          fontWeight: bold ? 500 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function lineFromSourceRef(ref: string | null): number | null {
  if (!ref) return null;
  const m = ref.match(/:l(\d+)/);
  if (!m) return null;
  return Number(m[1]);
}
