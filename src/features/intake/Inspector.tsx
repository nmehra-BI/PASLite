import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Pencil, X } from 'lucide-react';
import { useRanBerri } from '@/store';
import { ConfidenceDot, SourceRef } from '@/components';
import { effectiveValue, type Field } from '@/lib/field';
import { getAtPath } from '@/lib/paths';
import { isField } from '@/lib/deps';
import { ENRICHMENT_SOURCES } from '@/lib/fixtures';
import { useReadOnly } from '@/lib/readOnly';
import { useIntake, type InspectorTarget } from './intakeStore';
import { CorrectionInline } from './CorrectionInline';

/**
 * The inspector slides in from the right edge of the canvas body. It
 * supports three target kinds:
 *   - field    — full Field<T> detail with "correct this" affordance
 *   - source   — raw enrichment payload
 *   - conflict — detection metadata + resolution history
 */
export function Inspector() {
  const target = useIntake((s) => s.inspectorTarget);
  const close = useIntake((s) => s.closeInspector);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, close]);

  return (
    <AnimatePresence>
      {target && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(31, 30, 29, 0.06)',
              zIndex: 10,
            }}
            aria-hidden
          />
          <motion.aside
            key="panel"
            initial={{ x: 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 16, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="hairline-l"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 380,
              background: 'var(--color-surface)',
              zIndex: 11,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <InspectorBody target={target} onClose={close} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function InspectorBody({
  target,
  onClose,
}: {
  target: InspectorTarget;
  onClose: () => void;
}) {
  if (target.kind === 'field') return <FieldInspector path={target.path} onClose={onClose} />;
  if (target.kind === 'source') return <SourceInspector sourceId={target.sourceId} onClose={onClose} />;
  return <ConflictInspector conflictId={target.conflictId} onClose={onClose} />;
}

// ---------- Field inspector ----------

function FieldInspector({ path, onClose }: { path: string; onClose: () => void }) {
  const submission = useRanBerri((s) => s.submission);
  const readOnly = useReadOnly();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [path]);

  const field = submission ? (getAtPath(submission, path) as unknown) : null;
  if (!isField(field)) {
    return (
      <>
        <BareHeader label="inspector" subtitle={path} onClose={onClose} />
        <div style={{ padding: 18 }}>
          <em style={{ color: 'var(--color-ink-faint)' }}>not a field</em>
        </div>
      </>
    );
  }

  return (
    <>
      <FieldHeader
        path={path}
        editing={editing}
        readOnly={readOnly}
        onClose={onClose}
        onEdit={() => setEditing((e) => !e)}
      />
      <FieldBody
        path={path}
        field={field as Field<unknown>}
        editing={editing}
        onSaved={() => {
          setEditing(false);
          onClose();
        }}
        onCancel={() => setEditing(false)}
      />
    </>
  );
}

function FieldHeader({
  path,
  onClose,
  onEdit,
  editing,
  readOnly = false,
}: {
  path: string;
  onClose: () => void;
  onEdit: () => void;
  editing: boolean;
  readOnly?: boolean;
}) {
  return (
    <div
      className="hairline-b flex items-center justify-between"
      style={{ padding: '12px 18px', flex: '0 0 auto' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-mute)',
            letterSpacing: '0.06em',
          }}
        >
          inspector
        </span>
        <ChevronRight
          size={11}
          strokeWidth={1.5}
          style={{ color: 'var(--color-ink-faint)' }}
        />
        <span className="mono" style={{ fontSize: 11, color: 'var(--color-ink)' }}>
          {path}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {!readOnly && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Correct this field"
            className="inline-flex items-center gap-1"
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-button)',
              color: editing ? 'var(--color-accent)' : 'var(--color-ink-mute)',
              fontSize: 11.5,
            }}
          >
            <Pencil size={12} strokeWidth={1.5} />
            <span>correct this</span>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          style={{ padding: 4, color: 'var(--color-ink-mute)' }}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

function FieldBody({
  path,
  field,
  editing,
  onSaved,
  onCancel,
}: {
  path: string;
  field: Field<unknown>;
  editing: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const value = effectiveValue(field);
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
      <div
        className="serif"
        style={{
          fontSize: 22,
          fontWeight: 400,
          letterSpacing: '-0.012em',
          color: 'var(--color-ink)',
          lineHeight: 1.2,
        }}
      >
        {formatPretty(value)}
      </div>

      <div style={{ height: 14 }} />

      <Layer label="broker stated" tone="quiet">
        <span style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>
          {formatPretty(field.brokerStated) || <em>not stated</em>}
        </span>
      </Layer>

      <Layer label="system extracted">
        {field.systemExtracted ? (
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--color-ink)' }}>
              {formatPretty(field.systemExtracted.value)}
            </span>
            <ConfidenceDot confidence={field.systemExtracted.confidence} />
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--color-ink-mute)',
                letterSpacing: '0.04em',
              }}
            >
              conf {(field.systemExtracted.confidence * 100).toFixed(0)}%
            </span>
            <SourceRef
              sourceRef={field.systemExtracted.sourceRef}
              modelVersion={field.systemExtracted.modelVersion}
              extractedAt={field.systemExtracted.extractedAt}
            />
          </div>
        ) : (
          <em style={{ color: 'var(--color-ink-faint)' }}>not extracted</em>
        )}
      </Layer>

      <Layer label="underwriter corrected" tone={field.underwriterCorrected ? 'accent' : 'quiet'}>
        {field.underwriterCorrected ? (
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-ink)' }}>
              {formatPretty(field.underwriterCorrected.value)}
            </div>
            <div
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12,
                color: 'var(--color-ink-mute)',
                marginTop: 4,
              }}
            >
              &ldquo;{field.underwriterCorrected.reason}&rdquo;
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--color-ink-faint)',
                letterSpacing: '0.04em',
                marginTop: 4,
              }}
            >
              {field.underwriterCorrected.correctedBy} ·{' '}
              {new Date(field.underwriterCorrected.correctedAt).toLocaleString('en-GB')}
            </div>
          </div>
        ) : (
          <em style={{ color: 'var(--color-ink-faint)' }}>no correction yet</em>
        )}
      </Layer>

      {editing && (
        <div style={{ marginTop: 16 }}>
          <CorrectionInline
            path={path}
            field={field}
            onSaved={onSaved}
            onCancel={onCancel}
          />
        </div>
      )}
    </div>
  );
}

// ---------- Source inspector ----------

function SourceInspector({
  sourceId,
  onClose,
}: {
  sourceId: string;
  onClose: () => void;
}) {
  const source = useRanBerri((s) => s.enrichment.sources[sourceId]);
  const meta = ENRICHMENT_SOURCES.find((m) => m.id === sourceId);

  return (
    <>
      <BareHeader
        label="source"
        subtitle={meta?.name ?? sourceId}
        onClose={onClose}
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
        <div
          className="serif"
          style={{
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: 'var(--color-ink)',
          }}
        >
          {meta?.name ?? sourceId}
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            marginTop: 4,
          }}
        >
          {source?.result?.summary ?? '—'}
        </div>

        <Layer label="latency" tone="quiet">
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--color-ink-soft)' }}>
            {source?.latencyMs != null ? `${source.latencyMs} ms` : '—'}
          </span>
        </Layer>

        <Layer label="refreshed at" tone="quiet">
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--color-ink-soft)' }}>
            {source?.returnedAt
              ? new Date(source.returnedAt).toLocaleString('en-GB')
              : '—'}
          </span>
        </Layer>

        <Layer label="raw payload">
          <pre
            className="mono"
            style={{
              fontSize: 10.5,
              lineHeight: 1.55,
              color: 'var(--color-ink-soft)',
              background: 'var(--color-bg)',
              padding: 10,
              borderRadius: 'var(--radius-button)',
              overflow: 'auto',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(source?.result?.payload ?? null, null, 2)}
          </pre>
        </Layer>
      </div>
    </>
  );
}

// ---------- Conflict inspector ----------

function ConflictInspector({
  conflictId,
  onClose,
}: {
  conflictId: string;
  onClose: () => void;
}) {
  const conflict = useRanBerri((s) =>
    s.enrichment.conflicts.find((c) => c.id === conflictId),
  );

  return (
    <>
      <BareHeader
        label="conflict"
        subtitle={conflictId}
        onClose={onClose}
      />
      <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
        {conflict ? (
          <>
            <div className="eyebrow">field</div>
            <div
              className="mono"
              style={{ fontSize: 12, color: 'var(--color-ink)', marginTop: 2 }}
            >
              {conflict.fieldPath}
            </div>

            <Layer label="broker said">
              <span
                className="serif"
                style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--color-ink)' }}
              >
                {formatPretty(conflict.brokerValue)}
              </span>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--color-ink-faint)',
                  letterSpacing: '0.04em',
                  marginTop: 2,
                }}
              >
                {conflict.brokerSourceRef}
              </div>
            </Layer>

            <Layer label={conflict.externalSource}>
              <span
                className="mono"
                style={{ fontSize: 14, color: 'var(--color-ink)' }}
              >
                {formatPretty(conflict.externalValue)}
              </span>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--color-ink-faint)',
                  letterSpacing: '0.04em',
                  marginTop: 2,
                }}
              >
                {conflict.externalSourceRef}
              </div>
            </Layer>

            <Layer label="marginalia" tone="quiet">
              <span
                className="serif"
                style={{
                  fontStyle: 'italic',
                  fontSize: 12.5,
                  color: 'var(--color-ink-mute)',
                  lineHeight: 1.5,
                }}
              >
                {conflict.marginalia}
              </span>
            </Layer>

            {conflict.resolution ? (
              <Layer label="resolved" tone="accent">
                <div style={{ fontSize: 13, color: 'var(--color-ink)' }}>
                  {conflict.resolution.choice} → {formatPretty(conflict.resolution.value)}
                </div>
                <div
                  className="serif"
                  style={{
                    fontStyle: 'italic',
                    fontSize: 12,
                    color: 'var(--color-ink-mute)',
                    marginTop: 4,
                  }}
                >
                  &ldquo;{conflict.resolution.reason}&rdquo;
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--color-ink-faint)',
                    letterSpacing: '0.04em',
                    marginTop: 4,
                  }}
                >
                  {conflict.resolution.resolvedBy} ·{' '}
                  {new Date(conflict.resolution.resolvedAt).toLocaleString('en-GB')}
                </div>
              </Layer>
            ) : (
              <Layer label="status" tone="quiet">
                <em style={{ color: 'var(--color-ink-faint)' }}>unresolved</em>
              </Layer>
            )}
          </>
        ) : (
          <em style={{ color: 'var(--color-ink-faint)' }}>conflict not found</em>
        )}
      </div>
    </>
  );
}

// ---------- shared ----------

function BareHeader({
  label,
  subtitle,
  onClose,
}: {
  label: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div
      className="hairline-b flex items-center justify-between"
      style={{ padding: '12px 18px', flex: '0 0 auto' }}
    >
      <div className="flex items-center gap-2">
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-mute)',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </span>
        <ChevronRight
          size={11}
          strokeWidth={1.5}
          style={{ color: 'var(--color-ink-faint)' }}
        />
        <span className="mono" style={{ fontSize: 11, color: 'var(--color-ink)' }}>
          {subtitle}
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close inspector"
        style={{ padding: 4, color: 'var(--color-ink-mute)' }}
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function Layer({
  label,
  tone = 'default',
  children,
}: {
  label: string;
  tone?: 'default' | 'quiet' | 'accent';
  children: React.ReactNode;
}) {
  const fg =
    tone === 'accent'
      ? 'var(--color-accent)'
      : tone === 'quiet'
        ? 'var(--color-ink-faint)'
        : 'var(--color-ink-mute)';
  return (
    <div className="hairline-t" style={{ padding: '10px 0' }}>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: fg,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function formatPretty(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return v.join(', ');
  return JSON.stringify(v);
}
