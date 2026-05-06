import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { TriageCheckRecord } from '@/store/replay';
import { Button } from '@/components';
import { CapacityGauge } from './CapacityGauge';
import { OverrideModal } from './OverrideModal';

type Props = {
  record: TriageCheckRecord;
  readOnly?: boolean;
};

const MARGINALIA: Record<TriageCheckRecord['id'], string> = {
  appetite:
    'Bound authority permits this risk class. No exceptions invoked.',
  capacity:
    'Sufficient headroom for the projected line. No margin warning.',
  subjectivities:
    'Required disclosures addressed. Rate with assumption where pending.',
  sanctions:
    'No counterparty risk indicators. Standard terms permissible.',
};

const REFER_MARGINALIA: Record<TriageCheckRecord['id'], string> = {
  appetite:
    'One or more appetite rules failed. Refer to senior for exception.',
  capacity:
    'Capacity headroom insufficient or near-edge. Refer to senior.',
  subjectivities:
    'Required disclosure(s) unresolved. Refer to senior or queue with broker.',
  sanctions:
    'Partial match in sanctions screening. Refer to compliance.',
};

const DECLINE_MARGINALIA: Record<TriageCheckRecord['id'], string> = {
  appetite: 'Excluded risk class. Outside bound authority.',
  capacity: 'Projected consumption exceeds available capacity.',
  subjectivities: 'Disclosure deficiency cannot be reconciled.',
  sanctions: 'Direct sanctions hit. Bound authority does not permit binding.',
};

export function CheckDetailCard({ record, readOnly = false }: Props) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const effective = record.override?.outcome ?? record.outcome;
  const marginalia =
    effective === 'pass'
      ? MARGINALIA[record.id]
      : effective === 'refer'
        ? REFER_MARGINALIA[record.id]
        : DECLINE_MARGINALIA[record.id];

  const meta = record.metadata as
    | { consumedYTD?: number; annualCap?: number; thisSubmissionConsumption?: number }
    | undefined;

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        padding: '14px 22px 18px',
        borderTop: '0.5px solid var(--color-rule)',
      }}
    >
      <div className="eyebrow mb-3" style={{ color: 'var(--color-ink-mute)' }}>
        rules evaluated
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '78px 1fr auto',
          rowGap: 4,
          columnGap: 14,
          alignItems: 'baseline',
        }}
      >
        {record.rules.map((r) => (
          <RuleRow key={r.ruleId} rule={r} />
        ))}
      </div>

      {record.id === 'capacity' && meta && meta.consumedYTD != null && (
        <CapacityGauge
          consumed={meta.consumedYTD}
          cap={meta.annualCap ?? 50_000_000}
          thisSubmission={meta.thisSubmissionConsumption ?? 0}
        />
      )}

      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          marginTop: 12,
          maxWidth: '60ch',
          lineHeight: 1.5,
        }}
      >
        {marginalia}
      </div>

      {record.override && (
        <div
          className="hairline"
          style={{
            marginTop: 14,
            padding: '10px 12px',
            borderRadius: 'var(--radius-button)',
            background: 'var(--color-surface)',
          }}
        >
          <div
            className="eyebrow"
            style={{ color: 'var(--color-accent)' }}
          >
            override
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-ink)',
              marginTop: 2,
            }}
          >
            {record.outcome} → <strong>{record.override.outcome}</strong>
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
            &ldquo;{record.override.reason}&rdquo;
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
            {record.override.overriddenBy} ·{' '}
            {new Date(record.override.overriddenAt).toLocaleString('en-GB')}
          </div>
        </div>
      )}

      {!readOnly && (
        <div style={{ marginTop: 12 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOverrideOpen(true)}
          >
            Override outcome
          </Button>
        </div>
      )}

      {overrideOpen && (
        <OverrideModal
          checkId={record.id}
          currentOutcome={effective}
          onClose={() => setOverrideOpen(false)}
        />
      )}
    </div>
  );
}

function RuleRow({
  rule,
}: {
  rule: { ruleId: string; description: string; passed: boolean; testedValue?: string };
}) {
  const Icon = rule.passed ? Check : X;
  return (
    <>
      <span
        className="mono"
        style={{
          fontSize: 10.5,
          color: 'var(--color-ink-mute)',
          letterSpacing: '0.06em',
        }}
      >
        {rule.ruleId}
      </span>
      <span
        style={{
          fontSize: 13,
          color: 'var(--color-ink-soft)',
          letterSpacing: '-0.005em',
        }}
      >
        <span style={{ color: 'var(--color-ink)' }}>{rule.description}</span>
        {rule.testedValue && (
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--color-ink-mute)',
              marginLeft: 8,
            }}
          >
            {rule.testedValue}
          </span>
        )}
      </span>
      <Icon
        size={12}
        strokeWidth={1.75}
        style={{
          color: rule.passed
            ? 'var(--color-success)'
            : 'var(--color-danger)',
          alignSelf: 'center',
        }}
      />
    </>
  );
}
