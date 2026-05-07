import { useState } from 'react';
import { ArrowLeft, FileText, Sliders } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useConfig } from '@/config';
import { useAutonomy } from '@/store/autonomy';
import { Pill } from '@/components';
import type { DecisionClassConfig, DecisionClassId } from '@/lib/autonomy/types';
import { EditThresholdsModal } from './EditThresholdsModal';

const RESTRICTED_CLASSES: DecisionClassId[] = ['BIND-AUTO-COMMIT', 'NTU-AUTO-CAPTURE'];

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/**
 * Module 14 — Autonomy policy admin page (/settings/autonomy).
 * Editorial register matching the listing page; the policy is treated
 * as a contractual artefact between the MGA and capacity provider.
 */
export function AutonomyPolicyAdmin() {
  const policy = useAutonomy((s) => s.policy);
  const metrics = useAutonomy((s) => s.metrics);
  const toggleClass = useAutonomy((s) => s.toggleClass);
  const appendAuditEvent = useRanBerri((s) => s.appendAuditEvent);
  const [editingId, setEditingId] = useState<DecisionClassId | null>(null);
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  const enabledCount = Object.values(policy.decisionClasses).filter((c) => c.enabled).length;
  const editingCls = editingId ? policy.decisionClasses[editingId] : null;

  function handleToggle(cls: DecisionClassConfig) {
    const next = !cls.enabled;
    toggleClass(cls.id, next, 'nm');
    if (next) {
      appendAuditEvent({
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'autonomy.policyEnabled',
        classId: cls.id,
        approvedBy: 'nm',
        policyVersion: policy.version,
      });
    } else {
      appendAuditEvent({
        actor: { kind: 'underwriter', id: 'nm' },
        kind: 'autonomy.policyDisabled',
        classId: cls.id,
        disabledBy: 'nm',
        policyVersion: policy.version,
      });
    }
  }

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
          padding: '28px 36px 22px',
          background: 'var(--color-surface)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/';
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
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={11} strokeWidth={1.5} />
          back to listing
        </button>
        <h1
          className="serif"
          style={{
            fontSize: 24,
            fontWeight: 500,
            margin: 0,
            color: 'var(--color-ink)',
            letterSpacing: '-0.012em',
          }}
        >
          Autonomy policy
        </h1>
        <p
          className="serif"
          style={{
            fontSize: 14,
            color: 'var(--color-ink-mute)',
            marginTop: 6,
            maxWidth: 720,
            lineHeight: 1.6,
            letterSpacing: '-0.005em',
          }}
        >
          Configure where the AI acts on its own and where it asks for your
          judgment. Changes take effect immediately and are recorded in the
          audit log for capacity provider review.
        </p>
      </header>

      <section
        style={{
          margin: '20px 36px 0',
          padding: '14px 18px',
          border: '0.5px solid var(--color-rule-mid)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-surface)',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
          }}
        >
          policy version
        </div>
        <div
          className="serif"
          style={{ fontSize: 16, fontWeight: 500, marginTop: 4, color: 'var(--color-ink)' }}
        >
          {policy.version}
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
            marginTop: 4,
            letterSpacing: '-0.005em',
          }}
        >
          effective {DATE_FMT.format(new Date(policy.approvedBy.effectiveDate))} ·
          expires {DATE_FMT.format(new Date(policy.approvedBy.expiresAt))} ·
          approved by {policy.approvedBy.capacityProvider} (capacity) ·{' '}
          {policy.approvedBy.mgaOwner} (MGA)
        </div>
      </section>

      <section style={{ padding: '20px 36px 24px' }}>
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
            marginBottom: 12,
          }}
        >
          decision classes · enabled {enabledCount} of{' '}
          {Object.keys(policy.decisionClasses).length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.values(policy.decisionClasses).map((cls) => (
            <DecisionClassCard
              key={cls.id}
              cls={cls}
              metrics={metrics[cls.id]}
              isRestricted={RESTRICTED_CLASSES.includes(cls.id)}
              isRequested={!!requested[cls.id]}
              onToggle={() => handleToggle(cls)}
              onEdit={() => setEditingId(cls.id)}
              onRequestEnablement={() => {
                setRequested((r) => ({ ...r, [cls.id]: true }));
                appendAuditEvent({
                  actor: { kind: 'underwriter', id: 'nm' },
                  kind: 'listing.actionTaken',
                  viewedBy: 'nm',
                  entryRef: cls.id,
                  actionId: 'request-enablement',
                });
              }}
            />
          ))}
        </div>
      </section>

      {editingCls && (
        <EditThresholdsModal
          cls={editingCls}
          onClose={() => setEditingId(null)}
        />
      )}
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
        autonomy · admin · v0.14
      </span>
    </div>
  );
}

function DecisionClassCard({
  cls,
  metrics,
  isRestricted,
  isRequested,
  onToggle,
  onEdit,
  onRequestEnablement,
}: {
  cls: DecisionClassConfig;
  metrics: ReturnType<typeof useAutonomy.getState>['metrics'][DecisionClassId];
  isRestricted: boolean;
  isRequested: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRequestEnablement: () => void;
}) {
  const must = cls.autonomyBands.mustMatch;
  const cannot = cls.autonomyBands.cannotExceed;

  return (
    <article
      className="hairline"
      style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-surface)',
        borderColor: cls.enabled ? 'var(--color-accent)' : 'var(--color-rule-mid)',
      }}
    >
      <header
        className="flex items-baseline justify-between"
        style={{ marginBottom: 10, gap: 12 }}
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
            {cls.id}
          </div>
          <div
            className="serif"
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--color-ink)',
              marginTop: 2,
              letterSpacing: '-0.01em',
            }}
          >
            {cls.label}
          </div>
        </div>
        <Pill tone={cls.enabled ? 'success' : 'neutral'} mono>
          {cls.enabled ? 'ENABLED' : 'DISABLED'}
        </Pill>
      </header>

      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--color-ink-mute)',
          margin: '0 0 12px',
          lineHeight: 1.6,
          letterSpacing: '-0.005em',
        }}
      >
        {cls.description}
      </p>

      {cls.enabled && (
        <>
          <ConditionList title="Auto-acts when:" cond={must} />
          {cannot && Object.keys(cannot).length > 0 && (
            <ConditionList title="Will NOT auto-act if:" cond={cannot} variant="block" />
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 10,
            }}
          >
            <KV label="recall window">{cls.recallWindowHours}h</KV>
            <KV label="notify underwriter">{cls.notifyUnderwriter}</KV>
            {cls.maxPerDay !== undefined && (
              <KV label="max / day">{cls.maxPerDay}</KV>
            )}
            {cls.maxPerMonth !== undefined && (
              <KV label="max / month">{cls.maxPerMonth}</KV>
            )}
          </div>

          {metrics && (
            <div
              className="hairline-t"
              style={{ marginTop: 12, paddingTop: 10 }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: 'var(--color-ink-mute)',
                }}
              >
                last 30 days · {metrics.autoFired} auto-fired ·{' '}
                {metrics.recalled} recalled · {(metrics.accuracy * 100).toFixed(0)}% accuracy
              </span>
            </div>
          )}
        </>
      )}

      <div
        className="hairline-t flex items-center gap-2"
        style={{ marginTop: 12, paddingTop: 10, flexWrap: 'wrap' }}
      >
        {/* Restricted disabled classes: enablement requires capacity-provider sign-off. */}
        {!cls.enabled && isRestricted ? (
          isRequested ? (
            <span
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                padding: '4px 10px',
                borderRadius: 'var(--radius-button)',
                background: 'var(--color-sunken)',
                color: 'var(--color-ink-mute)',
                letterSpacing: '-0.005em',
              }}
            >
              Enablement requested · awaiting capacity-provider sign-off
            </span>
          ) : (
            <button
              type="button"
              onClick={onRequestEnablement}
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                padding: '4px 10px',
                borderRadius: 'var(--radius-button)',
                border: '0.5px solid var(--color-accent)',
                background: 'var(--color-accent)',
                color: 'var(--color-bg)',
                cursor: 'pointer',
                letterSpacing: '-0.005em',
              }}
            >
              Request enablement
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-button)',
              border: `0.5px solid ${cls.enabled ? 'var(--color-rule-mid)' : 'var(--color-accent)'}`,
              background: cls.enabled ? 'transparent' : 'var(--color-accent)',
              color: cls.enabled ? 'var(--color-ink-mute)' : 'var(--color-bg)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            {cls.enabled ? 'Disable' : 'Enable'}
          </button>
        )}

        {cls.enabled && (
          <button
            type="button"
            onClick={onEdit}
            className="serif inline-flex items-center gap-1"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-button)',
              border: '0.5px solid var(--color-rule-mid)',
              background: 'transparent',
              color: 'var(--color-ink-mute)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            <Sliders size={11} strokeWidth={1.5} />
            Edit thresholds
          </button>
        )}
        {cls.enabled && metrics.autoFired > 0 && (
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/exceptions';
            }}
            className="serif inline-flex items-center gap-1"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-accent)',
              background: 'transparent',
              border: 0,
              padding: '2px 6px',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            <FileText size={11} strokeWidth={1.5} />
            View {metrics.autoFired} auto-actions
          </button>
        )}
      </div>
    </article>
  );
}

function ConditionList({
  title,
  cond,
  variant,
}: {
  title: string;
  cond: Record<string, unknown>;
  variant?: 'block';
}) {
  const lines = Object.entries(cond).map(([k, v]) => formatCondition(k, v));
  if (lines.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: variant === 'block' ? 'var(--color-warn)' : 'var(--color-ink-faint)',
          marginBottom: 4,
        }}
      >
        {title}
      </div>
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
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function formatCondition(key: string, value: unknown): string {
  switch (key) {
    case 'confidenceMin':
      return `AI confidence ≥ ${(Number(value) * 100).toFixed(0)}%`;
    case 'premiumRangeMax':
      return `Premium under £${Number(value).toLocaleString('en-GB')}`;
    case 'capacityConsumptionMax':
      return `Capacity consumption under ${(Number(value) * 100).toFixed(0)}% of headroom`;
    case 'capacityHeadroomBelow':
      return `Capacity headroom must be > ${(Number(value) * 100).toFixed(0)}% of cap`;
    case 'lossRatioMax':
      return `Cohort LR ≤ ${(Number(value) * 100).toFixed(0)}%`;
    case 'lossesAvgMax':
      return `Expected LR ≤ ${(Number(value) * 100).toFixed(0)}%`;
    case 'profileMatchMin':
      return `Profile matches ≥ ${value} similar binders`;
    case 'brokerHistoryMin':
      return `Broker has ≥ ${value} prior submissions`;
    case 'sanctionsAlertLevelMax':
      return `Sanctions ${value}`;
    case 'appetiteFailureCategorical':
      return value ? 'Appetite failure must be clear-cut' : '';
    case 'anyConflictUnresolved':
      return value ? 'Any unresolved conflict' : '';
    case 'anyGapUnresolved':
      return value ? 'Any unresolved gap' : '';
    case 'anyOverrideRequired':
      return value ? 'Any triage check requires override' : '';
    case 'conflictType':
      return `Conflict type = ${value}`;
    case 'gapAmountAbs':
      return `Gap < £${Number(value).toLocaleString('en-GB')}`;
    case 'gapAmountPercent':
      return `Gap < ${(Number(value) * 100).toFixed(0)}% relative`;
    case 'sourceConfidenceMin':
      return `Source confidence ≥ ${(Number(value) * 100).toFixed(0)}%`;
    case 'brokerExplicitlyConfirmedNTU':
      return value ? 'Broker explicitly confirmed NTU' : '';
    case 'competitorIdentifiedFromKnownList':
      return value ? 'Competitor on known list' : '';
    case 'competitorPriceConfirmed':
      return value ? 'Competitor price confirmed' : '';
    default:
      return `${key}: ${String(value)}`;
  }
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        className="serif"
        style={{
          fontSize: 13,
          color: 'var(--color-ink)',
          letterSpacing: '-0.005em',
        }}
      >
        {children}
      </div>
    </div>
  );
}
