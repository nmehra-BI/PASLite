import { useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useReadOnly } from '@/lib/readOnly';

const STREAM_DURATION_MS = 1500;

type Props = {
  /** Skip the streaming intro (e.g. on subsequent opens). */
  alreadyStreamed?: boolean;
  /** Notify parent when the body is fully visible. */
  onStreamComplete?: () => void;
};

/**
 * Right-column email composition. Body streams in word-by-word over
 * ~1.5s on first mount; the user can edit at any time. Edits emit
 * `email.edited` events.
 */
export function EmailDraftEditor({
  alreadyStreamed = false,
  onStreamComplete,
}: Props) {
  const email = useRanBerri((s) => s.quote.email);
  const slipRef = useRanBerri((s) => s.quote.slipRef);
  const editEmail = useRanBerri((s) => s.editEmailField);
  const readOnly = useReadOnly();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [streaming, setStreaming] = useState(!alreadyStreamed);
  const [visible, setVisible] = useState<string>(
    alreadyStreamed ? email?.body ?? '' : '',
  );

  // Stream the body word by word on first mount.
  useEffect(() => {
    if (!email?.body) return;
    if (alreadyStreamed) {
      setVisible(email.body);
      setStreaming(false);
      return;
    }
    const words = email.body.split(/(\s+)/); // keep whitespace tokens
    const totalSteps = words.length;
    const stepInterval = Math.max(15, STREAM_DURATION_MS / totalSteps);
    let i = 0;
    setVisible('');
    const handle = setInterval(() => {
      i++;
      if (i >= totalSteps) {
        setVisible(email.body);
        setStreaming(false);
        clearInterval(handle);
        onStreamComplete?.();
        return;
      }
      setVisible(words.slice(0, i).join(''));
    }, stepInterval);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!email) {
    return (
      <div style={{ padding: 18 }}>
        <em style={{ color: 'var(--color-ink-faint)' }}>no email drafted</em>
      </div>
    );
  }

  const handleBodyBlur = () => {
    if (!bodyRef.current) return;
    const next = bodyRef.current.innerText;
    if (next === email.body) return;
    editEmail({ field: 'body', nextValue: next, editedBy: 'nm' });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div
        className="hairline-b"
        style={{ padding: '12px 22px', flex: '0 0 auto' }}
      >
        <div className="eyebrow">email · drafting</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          Sonnet drafted · review and edit
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minHeight: 0,
        }}
      >
        <Row label="to">
          <span
            className="mono"
            style={{ fontSize: 12, color: 'var(--color-ink)' }}
          >
            Sarah Whitfield &lt;{email.recipient}&gt;
          </span>
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 11.5,
              color: 'var(--color-ink-faint)',
              marginLeft: 8,
            }}
          >
            (locked — broker on file)
          </span>
        </Row>
        <Row label="cc">
          <button
            type="button"
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--color-accent)',
              padding: 0,
            }}
            disabled={readOnly}
          >
            + Add cc
          </button>
        </Row>
        <Row label="subject">
          <SubjectField subject={email.subject} readOnly={readOnly} />
        </Row>

        <div
          ref={bodyRef}
          contentEditable={!readOnly && !streaming}
          suppressContentEditableWarning
          onBlur={handleBodyBlur}
          className="serif email-body"
          style={{
            flex: 1,
            outline: 'none',
            background: 'var(--color-bg)',
            border: '0.5px solid var(--color-rule)',
            borderRadius: 'var(--radius-card)',
            padding: '14px 16px',
            fontStyle: 'italic',
            fontSize: 13.5,
            lineHeight: 1.65,
            color: 'var(--color-ink-soft)',
            whiteSpace: 'pre-wrap',
            letterSpacing: '-0.005em',
            minHeight: 240,
            cursor: streaming ? 'wait' : readOnly ? 'default' : 'text',
            position: 'relative',
            textDecoration: streaming ? 'underline' : 'none',
            textDecorationColor: 'var(--color-accent)',
            textDecorationStyle: 'dotted',
            textDecorationThickness: '0.5px',
            textUnderlineOffset: 4,
          }}
        >
          {visible}
        </div>

        <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
          <Paperclip
            size={11}
            strokeWidth={1.5}
            style={{ color: 'var(--color-ink-faint)' }}
          />
          <span
            className="mono"
            style={{ fontSize: 11, color: 'var(--color-ink)' }}
          >
            quote-slip-{(slipRef ?? 'pol-29481-q1').toLowerCase()}.pdf
          </span>
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 11.5,
              color: 'var(--color-ink-faint)',
            }}
          >
            (1 page · auto-generated)
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-baseline gap-3"
      style={{ paddingBottom: 4 }}
    >
      <span
        className="mono"
        style={{
          minWidth: 56,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

function SubjectField({
  subject,
  readOnly,
}: {
  subject: string;
  readOnly: boolean;
}) {
  const editEmail = useRanBerri((s) => s.editEmailField);
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onBlur={() => {
        if (!ref.current) return;
        const next = ref.current.textContent ?? '';
        if (next === subject) return;
        editEmail({ field: 'subject', nextValue: next, editedBy: 'nm' });
      }}
      style={{
        outline: 'none',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        color: 'var(--color-ink)',
      }}
    >
      {subject}
    </span>
  );
}
