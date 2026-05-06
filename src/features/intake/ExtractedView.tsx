import { AnimatePresence, motion } from 'framer-motion';
import { useRanBerri } from '@/store';
import { useIntake } from './intakeStore';
import { FieldLine } from './FieldLine';
import { Pill } from '@/components';
import { effectiveValue } from '@/lib/field';
import type { Field } from '@/lib/field';
import type { LossRun } from '@/lib/fixtures';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const formatGBP = (n: number) => `£${n.toLocaleString()}`;
const formatGBPm = (n: number) =>
  n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}M` : `£${n.toLocaleString()}`;
const formatDate = (iso: string) => DATE_FMT.format(new Date(iso));

/**
 * The editorial extracted view. Rendered when the cinematic sequence
 * has settled. NOT a generic table &mdash; this is the AI's voice
 * presenting its work.
 */
export function ExtractedView() {
  const submission = useRanBerri((s) => s.submission);
  const phase = useIntake((s) => s.phase);
  const avgConfidence = useIntake((s) => s.avgConfidence);
  const fieldCount = useIntake((s) => s.fieldCount);
  const completedAt = useIntake((s) => s.completedAt);

  if (!submission) return null;
  // During the extracting phase we still want to show fields as they
  // appear, so we render the same view; the FieldLine animations stagger.
  const isComplete = phase === 'complete';

  const insured = submission.insured;
  const cover = submission.cover;
  const turnoverFy24 = effectiveValue(insured.turnover) as number | null;
  const stamp = completedAt
    ? new Date(completedAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const summary = isComplete
    ? `${effectiveValue(insured.legalName)} · UK W&R · ${submission.sites.length} sites · ${
        turnoverFy24 ? formatGBPm(turnoverFy24) : '—'
      } turnover`
    : 'Extraction in progress';

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '24px 28px',
      }}
    >
      <Header
        summary={summary}
        avgConfidence={avgConfidence}
        fieldCount={fieldCount}
        stamp={stamp}
      />

      <Group label="insured">
        <FieldLine path="insured.legalName" field={insured.legalName} />
        <FieldLine
          path="insured.companiesHouseNumber"
          field={insured.companiesHouseNumber}
          inlineLabel="CHN"
        />
      </Group>

      <Group label="turnover">
        <FieldLine
          path="insured.turnover"
          field={insured.turnover}
          inlineLabel="FY24"
          format={formatGBP}
        />
        <FieldLine
          path="insured.turnoverPrior"
          field={insured.turnoverPrior}
          inlineLabel="FY23"
          format={formatGBP}
        />
      </Group>

      <Group label={`sites · ${submission.sites.length}`}>
        {submission.sites.map((site, i) => (
          <SiteRow key={site.id} site={site} index={i} />
        ))}
      </Group>

      <Group label="materials">
        <FieldLine
          path="materials"
          field={submission.materials}
          format={(arr: string[]) => `Mixed dry recyclables — ${arr.join(', ')}`}
        />
      </Group>

      <Group label="coverage">
        <FieldLine
          path="cover.inceptionDate"
          field={cover.inceptionDate}
          inlineLabel="Inception"
          format={formatDate}
        />
        <FieldLine
          path="cover.term"
          field={cover.term}
          inlineLabel="Term"
        />
        <FieldLine
          path="fireSuppressionDisclosed"
          field={submission.fireSuppressionDisclosed}
          inlineLabel="Fire suppression"
          format={(v) => (v === false ? 'not disclosed' : 'disclosed')}
          tone="warn"
        />
      </Group>

      <Group
        label={`loss history · ${(effectiveValue(submission.lossRuns) as LossRun[] | null)?.length ?? 0} years`}
        rightSlot={
          <FieldLine
            path="statedLossRatio"
            field={submission.statedLossRatio}
            inlineLabel="LR"
            format={(v) => `${(v * 100).toFixed(0)}%`}
          />
        }
      >
        <LossRunsList field={submission.lossRuns} />
      </Group>

      <Group label="broker target">
        <FieldLine
          path="brokerTargetPremium"
          field={submission.brokerTargetPremium}
          format={formatGBP}
        />
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 11.5,
            color: 'var(--color-ink-faint)',
            margin: '4px 0 0',
          }}
        >
          treated as the broker&rsquo;s voice; not a fact.
        </p>
      </Group>
    </div>
  );
}

function Header({
  summary,
  avgConfidence,
  fieldCount,
  stamp,
}: {
  summary: string;
  avgConfidence: number | null;
  fieldCount: number | null;
  stamp: string | null;
}) {
  return (
    <div className="hairline-b" style={{ paddingBottom: 18, marginBottom: 18 }}>
      <div className="eyebrow">AI extracted</div>
      <h2
        className="serif"
        style={{
          fontSize: 22,
          fontWeight: 400,
          letterSpacing: '-0.012em',
          color: 'var(--color-ink)',
          margin: '6px 0 6px',
          lineHeight: 1.2,
        }}
      >
        {summary}
      </h2>
      <div className="flex items-center gap-3">
        <span
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-mute)',
          }}
        >
          Sonnet · {fieldCount ?? '—'} fields · grounded
          {stamp ? ` · ${stamp}` : ''}
        </span>
        {avgConfidence !== null && (
          <Pill tone="success" mono>
            CONF {(avgConfidence * 100).toFixed(0)}%
          </Pill>
        )}
      </div>
    </div>
  );
}

function Group({
  label,
  children,
  rightSlot,
}: {
  label: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 6 }}
      >
        <div className="eyebrow">{label}</div>
        {rightSlot}
      </div>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function SiteRow({
  site,
  index,
}: {
  site: import('@/lib/fixtures').Site;
  index: number;
}) {
  const roman = ['i.', 'ii.', 'iii.', 'iv.', 'v.'][index] ?? `${index + 1}.`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <FieldLine
        path={`sites[${index}].name`}
        field={site.name}
        inlineLabel={roman}
      />
      <div
        className="flex items-baseline"
        style={{ paddingLeft: 64, gap: 14 }}
      >
        <FieldLine
          path={`sites[${index}].sqm`}
          field={site.sqm}
          format={(v) => `${v.toLocaleString()} sqm`}
        />
        <FieldLine
          path={`sites[${index}].permitRef`}
          field={site.permitRef}
          inlineLabel="EA"
        />
        <FieldLine
          path={`sites[${index}].permitExpiry`}
          field={site.permitExpiry}
          inlineLabel="exp"
          format={formatDate}
        />
      </div>
    </div>
  );
}

function LossRunsList({ field }: { field: Field<LossRun[]> }) {
  const runs = effectiveValue(field) as LossRun[] | null;
  if (!runs) return null;
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {runs.map((r) => {
        const material = r.amount >= 100_000;
        return (
          <li
            key={r.year}
            className="serif"
            style={{
              fontSize: 13.5,
              color: material ? 'var(--color-warn)' : 'var(--color-ink-soft)',
              padding: '3px 0',
            }}
          >
            <span className="mono" style={{ fontSize: 11, color: 'var(--color-ink-faint)' }}>
              {r.year}
            </span>{' '}
            · {r.type} ·{' '}
            <span style={{ color: material ? 'var(--color-warn)' : 'var(--color-ink)' }}>
              {formatGBP(r.amount)}
            </span>
            {r.note && (
              <span
                style={{
                  fontStyle: 'italic',
                  fontSize: 11.5,
                  color: 'var(--color-ink-mute)',
                  marginLeft: 8,
                }}
              >
                {r.note}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
