import { useRanBerri } from '@/store';
import type { ChapterId } from '@/store/canvasUI';

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return TIME_FMT.format(new Date(iso));
}

/**
 * Editorial one-line summary per module. Reads from the live store
 * — same source of truth as the expanded sections, so the summary
 * never disagrees with what the user sees on click-to-expand.
 *
 * Each summary follows the spec's pattern:
 *   "✓ Extraction · 12 fields · avg conf 0.94 · 9 May 09:14"
 * with mono-styled refs / numbers inline (the parent SummaryRow
 * already applies italic-serif; we keep mono inserts inline).
 */
export function SectionSummary({ chapter }: { chapter: ChapterId }) {
  switch (chapter) {
    case 'extraction':
      return <ExtractionSummary />;
    case 'enrichment':
      return <EnrichmentSummary />;
    case 'triage':
      return <TriageSummary />;
    case 'rating':
      return <RatingSummary />;
    case 'quote':
      return <QuoteSummary />;
    case 'recommendation':
      return <RecommendationSummary />;
    case 'bind':
      return <BindSummary />;
    case 'mta-04':
      return <MtaSummary />;
    case 'cancellation':
      return <CancellationSummary />;
    case 'renewal':
      return <RenewalSummary />;
  }
}

function ExtractionSummary() {
  const log = useRanBerri((s) => s.auditLog);
  const completed = log.find((e) => e.kind === 'extraction.completed');
  if (completed && completed.kind === 'extraction.completed') {
    return (
      <>
        Extraction · <Mono>{completed.fieldCount} fields</Mono> · avg conf{' '}
        <Mono>{completed.avgConfidence.toFixed(2)}</Mono> · {fmt(completed.at)}
      </>
    );
  }
  return <>Extraction in progress…</>;
}

function EnrichmentSummary() {
  const enrichment = useRanBerri((s) => s.enrichment);
  if (enrichment.phase === 'settled') {
    const conflicts = enrichment.conflicts.filter((c) => c.resolution !== null && !c.dismissed).length;
    const gaps = enrichment.gaps.filter((g) => g.resolution !== null).length;
    const sourceCount = Object.keys(enrichment.sources).length;
    return (
      <>
        Enrichment · <Mono>{sourceCount} sources</Mono> ·{' '}
        <Mono>{conflicts} conflict{conflicts === 1 ? '' : 's'} resolved</Mono> ·{' '}
        <Mono>{gaps} gap{gaps === 1 ? '' : 's'} resolved</Mono>
      </>
    );
  }
  return <>Enrichment running…</>;
}

function TriageSummary() {
  const triage = useRanBerri((s) => s.triage);
  if (triage.verdict) {
    const passed = triage.checks.filter((c) => (c.override?.outcome ?? c.outcome) === 'pass').length;
    return (
      <>
        Triage · <Mono>{passed} of {triage.checks.length} checks passed</Mono> · verdict{' '}
        <Mono>{triage.verdict.toUpperCase()}</Mono>
        {triage.completedAt && <> · {fmt(triage.completedAt)}</>}
      </>
    );
  }
  return <>Triage pending…</>;
}

function RatingSummary() {
  const rating = useRanBerri((s) => s.rating);
  if (rating.output) {
    return (
      <>
        Rating · <Mono>£{rating.output.premium.toLocaleString('en-GB')}</Mono> · sealed{' '}
        <Mono>{rating.output.version}</Mono> · <Mono>{rating.output.sha}</Mono>
        {rating.output.computedAt && <> · {fmt(rating.output.computedAt)}</>}
      </>
    );
  }
  return <>Rating pending…</>;
}

function QuoteSummary() {
  const quote = useRanBerri((s) => s.quote);
  if (quote.phase === 'sent' && quote.email) {
    const broker = quote.email.recipient;
    return (
      <>
        Quote slip · <Mono>£{(quote.slipPremium ?? 0).toLocaleString('en-GB')}</Mono> · sent to{' '}
        {broker} · {fmt(quote.sentAt)}
      </>
    );
  }
  if (quote.phase === 'slip-ready') {
    return (
      <>
        Quote slip ready · <Mono>£{(quote.slipPremium ?? 0).toLocaleString('en-GB')}</Mono> · awaiting send
      </>
    );
  }
  return <>Quote pending…</>;
}

function RecommendationSummary() {
  const r = useRanBerri((s) => s.recommendation);
  if (r.phase === 'settled' && r.primary) {
    return (
      <>
        Recommendation · <Mono>{r.primary.toUpperCase()}</Mono> · {r.confidence} confidence
        {r.completedAt && <> · {fmt(r.completedAt)}</>}
      </>
    );
  }
  return <>Recommendation evaluating…</>;
}

function BindSummary() {
  const bind = useRanBerri((s) => s.bind);
  if (bind.phase === 'committed') {
    return (
      <>
        Bound · <Mono>{bind.policyRef}</Mono> · 4 hashes signed
        {bind.committedAt && <> · {fmt(bind.committedAt)}</>}
      </>
    );
  }
  if (bind.phase === 'in-progress') {
    const confirmed = bind.hashes.filter(
      (h) => h.status === 'confirmed' || h.status === 'overridden',
    ).length;
    return (
      <>
        Bind ceremony · <Mono>{confirmed} of 4 hashes confirmed</Mono>
      </>
    );
  }
  return <>Bind pending…</>;
}

function MtaSummary() {
  const mta = useRanBerri((s) => s.mta);
  const policy = useRanBerri((s) => s.policy);
  if (mta.phase === 'committed' || mta.phase === 'sent') {
    const v = policy.versions[policy.versions.length - 1];
    if (v) {
      return (
        <>
          MTA-{v.endorsementNumber.toString().padStart(2, '0')} · {v.changeType} · AP{' '}
          <Mono>£{v.proRatedAP.toLocaleString('en-GB')}</Mono>
          {' · '}
          <Mono>{v.scheduleRef}</Mono>
        </>
      );
    }
  }
  if (mta.request) {
    return (
      <>
        MTA in progress · {mta.request.changeType} · effective{' '}
        <Mono>{mta.request.effectiveDate.slice(0, 10)}</Mono>
      </>
    );
  }
  return <>MTA pending…</>;
}

function CancellationSummary() {
  const c = useRanBerri((s) => s.cancellation);
  if (c.phase === 'committed' || c.phase === 'sent') {
    return (
      <>
        Cancelled · <Mono>{c.endorsementRef}</Mono> · refund{' '}
        <Mono>£{(c.calc?.refund ?? 0).toLocaleString('en-GB')}</Mono>
        {c.committedAt && <> · {fmt(c.committedAt)}</>}
      </>
    );
  }
  if (c.request) {
    return (
      <>
        Cancellation in progress · {c.request.reasonCategory} · effective{' '}
        <Mono>{c.request.effectiveDate.slice(0, 10)}</Mono>
      </>
    );
  }
  return <>Cancellation pending…</>;
}

function RenewalSummary() {
  const r = useRanBerri((s) => s.renewal);
  if (r.phase === 'committed' || r.phase === 'sent') {
    return (
      <>
        Renewed · <Mono>{r.successorPolicyRef}</Mono> · year 2 ·{' '}
        <Mono>£{(r.selectedOption?.premium ?? 0).toLocaleString('en-GB')}</Mono>
        {r.committedAt && <> · {fmt(r.committedAt)}</>}
      </>
    );
  }
  if (r.phase === 'recommendation-ready' && r.recommendation.primary) {
    return (
      <>
        Renewal recommendation · <Mono>{r.recommendation.primary.toUpperCase()}</Mono> ·{' '}
        {r.recommendation.confidence} confidence
      </>
    );
  }
  if (r.triggeredAt) {
    return (
      <>
        Renewal triggered · prior <Mono>{r.priorPolicyRef}</Mono> · {fmt(r.triggeredAt)}
      </>
    );
  }
  return <>Renewal pending…</>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 12,
        color: 'var(--color-ink)',
        letterSpacing: '0.04em',
        fontStyle: 'normal',
      }}
    >
      {children}
    </span>
  );
}
