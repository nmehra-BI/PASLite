import { useRanBerri } from '@/store';
import type { AuditEvent } from '@/lib/audit';
import { ALL_ARTIFACTS, type ArtifactKey } from '@/lib/deps';

const KIND_LABEL: Record<AuditEvent['kind'], string> = {
  'submission.received': 'Submission received',
  'submission.created': 'Submission created',
  'email.received': 'Email received',
  'extraction.started': 'Extraction started',
  'extraction.fieldExtracted': 'Field extracted',
  'extraction.completed': 'Extraction completed',
  'extraction.rerun': 'Extraction rerun',
  'enrichment.started': 'Enrichment started',
  'enrichment.sourceQueried': 'Source queried',
  'enrichment.sourceReturned': 'Source returned',
  'enrichment.completed': 'Enrichment completed',
  'enrichment.rerun': 'Enrichment rerun',
  'conflict.detected': 'Conflict raised',
  'conflict.resolved': 'Conflict resolved',
  'conflict.dismissed': 'Conflict reconciled',
  'conflict.flagged': 'Conflict flagged',
  'gap.flagged': 'Gap flagged',
  'gap.detected': 'Gap surfaced',
  'gap.resolved': 'Gap resolved',
  'gap.dismissed': 'Gap closed',
  'gap.requestSent': 'Broker request queued',
  'field.corrected': 'Field corrected',
  'triage.started': 'Triage started',
  'triage.checkEvaluated': 'Triage check evaluated',
  'triage.completed': 'Triage completed',
  'triage.verdictChanged': 'Verdict changed',
  'triage.rerun': 'Triage rerun',
  'triage.checkOverridden': 'Triage check overridden',
  'triage.passedToRating': 'Passed to rating',
  'submission.referred': 'Submission referred',
  'submission.recalled': 'Submission recalled',
  'submission.declined': 'Submission declined',
  'rating.computed': 'Rating computed',
  'rating.started': 'Rating started',
  'rating.cellComputed': 'Rating cell computed',
  'rating.completed': 'Rating completed',
  'rating.rerun': 'Rating rerun',
  'slip.generated': 'Quote slip generated',
  'slip.fieldEdited': 'Slip field edited',
  'slip.regenerated': 'Slip regenerated',
  'email.drafted': 'Email drafted',
  'email.edited': 'Email edited',
  'email.streamFinished': 'Email body settled',
  'quote.sent': 'Quote sent to broker',
  'quote.recalled': 'Quote recalled',
  'quote.markedStale': 'Quote marked stale',
  'quote.issued': 'Quote issued',
  'recommendation.generated': 'Recommendation generated',
  'recommendation.started': 'Recommendation started',
  'recommendation.factorEvaluated': 'Recommendation factor evaluated',
  'recommendation.completed': 'Recommendation completed',
  'recommendation.verdictChanged': 'Recommendation verdict changed',
  'recommendation.rerun': 'Recommendation rerun',
  'recommendation.actedUpon': 'Recommendation acted upon',
  'submission.advancedToBindPending': 'Submission advanced to bind-pending',
  'submission.advancedToNtuPending': 'Submission advanced to NTU-pending',
  'decision.recorded': 'Decision recorded',
  'artifact.computed': 'Artifact computed',
  'artifact.stale': 'Artifact marked stale',
  // Module 8 — bind ceremony
  'bind.ceremonyStarted': 'Bind ceremony started',
  'bind.hashConfirmed': 'Hash confirmed',
  'bind.hashFailed': 'Hash failed',
  'bind.hashOverridden': 'Hash overridden',
  'bind.committed': 'Bind committed',
  'bind.held': 'Bind held for review',
  'schedule.generated': 'Schedule generated',
  'schedule.sent': 'Schedule sent to broker',
  'subjectivity.created': 'Subjectivity created',
  'subjectivity.tracked': 'Subjectivity tracked',
  'audit.viewed': 'Audit log viewed',
  'audit.exported': 'Audit log exported',
  'audit.stateReplayed': 'State replayed',
  // Module 9 — endorsement / MTA
  'mta.requestReceived': 'MTA request received',
  'mta.extracted': 'MTA fields extracted',
  'mta.gapFlagged': 'MTA gap flagged',
  'mta.gapResolved': 'MTA gap resolved',
  'mta.deltaRated': 'Delta rating completed',
  'mta.capacityRechecked': 'Capacity re-checked',
  'mta.scheduleGenerated': 'Revised schedule generated',
  'mta.scheduleEdited': 'Schedule field edited',
  'mta.hashConfirmed': 'MTA hash confirmed',
  'mta.hashOverridden': 'MTA hash overridden',
  'mta.committed': 'MTA committed',
  'mta.scheduleSent': 'Revised schedule sent',
  'mta.fieldCorrected': 'MTA field corrected',
  'mta.markedStale': 'MTA marked stale',
  // Module 10 — cancellation
  'cancellation.requestReceived': 'Cancellation request received',
  'cancellation.basisSelected': 'Refund basis selected',
  'cancellation.basisOverridden': 'Refund basis overridden',
  'cancellation.runoffClaimCaptured': 'Run-off claim captured',
  'cancellation.refundComputed': 'Refund computed',
  'cancellation.hashConfirmed': 'Cancellation hash confirmed',
  'cancellation.hashOverridden': 'Cancellation hash overridden',
  'cancellation.committed': 'Cancellation committed',
  'cancellation.endorsementSent': 'Cancellation endorsement sent',
  'bordereau.entryWritten': 'Bordereau entry written',
  'competitor.switchRecorded': 'Competitor switch recorded',
  // Module 11 — renewal
  'claim.recorded': 'Claim recorded',
  'subjectivity.satisfied': 'Subjectivity satisfied',
  'renewal.triggered': 'Renewal triggered',
  'renewal.year1ReviewBuilt': 'Year-1 review built',
  'renewal.insuredChangesCaptured': 'Year-2 changes captured',
  'renewal.year2Rated': 'Year-2 rated',
  'renewal.defencePricingComputed': 'Defence pricing computed',
  'renewal.optionSelected': 'Defence option selected',
  'renewal.recommendationCompleted': 'Renewal recommendation completed',
  'renewal.slipGenerated': 'Renewal slip generated',
  'renewal.slipSent': 'Renewal slip sent',
  'renewal.hashConfirmed': 'Renewal hash confirmed',
  'renewal.committed': 'Renewal committed',
  'renewal.scheduleSent': 'Renewal schedule sent',
  // Module 12 — listing / workspace
  'listing.viewed': 'Listing viewed',
  'listing.actionTaken': 'Listing action taken',
  'listing.searchPerformed': 'Listing search performed',
  'chase.sent': 'Chase email sent',
};

const ARTIFACT_LABEL: Record<ArtifactKey, string> = {
  enrichment: 'Enrichment',
  conflicts: 'Conflicts',
  triage: 'Triage',
  rating: 'Rating',
  quote: 'Quote',
  recommendation: 'Recommendation',
};

function formatActor(actor: AuditEvent['actor']): string {
  if (actor.kind === 'system') return actor.modelVersion ?? 'system';
  if (actor.kind === 'underwriter') return actor.id;
  return actor.id;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function dotTone(kind: AuditEvent['kind']): string {
  if (
    kind === 'gap.flagged' ||
    kind === 'gap.detected' ||
    kind === 'conflict.flagged' ||
    kind === 'conflict.detected' ||
    kind === 'artifact.stale' ||
    kind === 'triage.verdictChanged' ||
    kind === 'submission.referred' ||
    kind === 'bind.held'
  )
    return 'var(--color-warn)';
  if (
    kind === 'field.corrected' ||
    kind === 'conflict.resolved' ||
    kind === 'gap.resolved' ||
    kind === 'triage.checkOverridden' ||
    kind === 'bind.hashOverridden'
  )
    return 'var(--color-accent)';
  if (kind === 'submission.declined' || kind === 'quote.markedStale' || kind === 'bind.hashFailed')
    return 'var(--color-danger)';
  if (
    kind === 'mta.gapFlagged' ||
    kind === 'mta.markedStale' ||
    kind === 'cancellation.requestReceived'
  )
    return 'var(--color-warn)';
  if (
    kind === 'mta.hashOverridden' ||
    kind === 'mta.fieldCorrected' ||
    kind === 'cancellation.basisOverridden' ||
    kind === 'cancellation.hashOverridden'
  )
    return 'var(--color-accent)';
  if (
    kind === 'extraction.completed' ||
    kind === 'enrichment.completed' ||
    kind === 'rating.computed' ||
    kind === 'rating.completed' ||
    kind === 'slip.generated' ||
    kind === 'quote.issued' ||
    kind === 'quote.sent' ||
    kind === 'artifact.computed' ||
    kind === 'conflict.dismissed' ||
    kind === 'gap.dismissed' ||
    kind === 'triage.completed' ||
    kind === 'triage.passedToRating' ||
    kind === 'recommendation.completed' ||
    kind === 'recommendation.actedUpon' ||
    kind === 'submission.advancedToBindPending' ||
    kind === 'bind.hashConfirmed' ||
    kind === 'bind.committed' ||
    kind === 'schedule.generated' ||
    kind === 'schedule.sent' ||
    kind === 'subjectivity.created' ||
    kind === 'mta.requestReceived' ||
    kind === 'mta.extracted' ||
    kind === 'mta.gapResolved' ||
    kind === 'mta.deltaRated' ||
    kind === 'mta.capacityRechecked' ||
    kind === 'mta.scheduleGenerated' ||
    kind === 'mta.hashConfirmed' ||
    kind === 'mta.committed' ||
    kind === 'mta.scheduleSent' ||
    kind === 'cancellation.committed' ||
    kind === 'cancellation.endorsementSent' ||
    kind === 'bordereau.entryWritten' ||
    kind === 'renewal.year1ReviewBuilt' ||
    kind === 'renewal.year2Rated' ||
    kind === 'renewal.recommendationCompleted' ||
    kind === 'renewal.slipGenerated' ||
    kind === 'renewal.slipSent' ||
    kind === 'renewal.hashConfirmed' ||
    kind === 'renewal.committed' ||
    kind === 'renewal.scheduleSent'
  )
    return 'var(--color-success)';
  return 'var(--color-ink)';
}

/**
 * The trail aggregates duplicates that fire in the same second
 * (e.g. 12 extraction.fieldExtracted events). Field-level events get
 * collapsed into a single row that shows the count + average
 * confidence; the underlying log is untouched.
 */
type EventEntry = {
  kind: 'event';
  event: AuditEvent;
  count?: number;
  subtitle?: string;
};

function aggregate(log: AuditEvent[]): EventEntry[] {
  // Hide noise-y replay-only events. The cinematic emits one query+return
  // per source and one event per check, but the user-facing rail
  // summarises the whole pass via the *.completed events.
  const filtered = log.filter(
    (e) =>
      e.kind !== 'extraction.fieldExtracted' &&
      e.kind !== 'submission.created' &&
      e.kind !== 'enrichment.sourceQueried' &&
      e.kind !== 'enrichment.sourceReturned' &&
      e.kind !== 'triage.checkEvaluated' &&
      e.kind !== 'rating.cellComputed' &&
      e.kind !== 'slip.fieldEdited' &&
      e.kind !== 'email.edited' &&
      e.kind !== 'email.streamFinished' &&
      e.kind !== 'recommendation.factorEvaluated',
  );
  return filtered.map((event) => {
    if (event.kind === 'extraction.completed') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.fieldCount} fields · avg conf ${(event.avgConfidence * 100).toFixed(0)}%`,
      };
    }
    if (event.kind === 'enrichment.completed') {
      const conflicts = event.conflictCount;
      const gaps = event.gapCount;
      const confirmed = event.sources.length - conflicts;
      return {
        kind: 'event',
        event,
        subtitle: `${event.sources.length} sources · ${conflicts} conflict${conflicts === 1 ? '' : 's'} · ${gaps} gap${gaps === 1 ? '' : 's'} · ${confirmed} confirmed`,
      };
    }
    if (event.kind === 'gap.flagged' || event.kind === 'gap.detected') {
      return { kind: 'event', event, subtitle: event.description };
    }
    if (event.kind === 'gap.resolved') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.fieldPath} · ${event.choice}`,
      };
    }
    if (event.kind === 'gap.requestSent') {
      return {
        kind: 'event',
        event,
        subtitle: `to ${event.recipient}`,
      };
    }
    if (event.kind === 'conflict.detected') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.fieldPath} · ${event.externalSource}`,
      };
    }
    if (event.kind === 'conflict.resolved') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.fieldPath} · ${event.choice}`,
      };
    }
    if (event.kind === 'conflict.dismissed') {
      return { kind: 'event', event, subtitle: event.reason };
    }
    if (event.kind === 'gap.dismissed') {
      return { kind: 'event', event, subtitle: event.reason };
    }
    if (event.kind === 'field.corrected') {
      const subtitle = event.note
        ? `${event.fieldPath} · ${event.note}`
        : event.fieldPath;
      return { kind: 'event', event, subtitle };
    }
    if (event.kind === 'artifact.stale') {
      return { kind: 'event', event, subtitle: event.artifact };
    }
    if (event.kind === 'artifact.computed') {
      return { kind: 'event', event, subtitle: event.artifact };
    }
    if (event.kind === 'extraction.rerun') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.preservedCorrections} corrections preserved`,
      };
    }
    if (event.kind === 'enrichment.rerun') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.preservedResolutions} resolutions preserved`,
      };
    }
    if (event.kind === 'triage.completed') {
      const passed = event.verdict === 'pass';
      return {
        kind: 'event',
        event,
        subtitle: passed ? 'verdict: clear to rate' : `verdict: ${event.verdict}`,
      };
    }
    if (event.kind === 'triage.verdictChanged') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.from} → ${event.to} · ${event.cause}`,
      };
    }
    if (event.kind === 'triage.checkOverridden') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.check} · ${event.from} → ${event.to}`,
      };
    }
    if (event.kind === 'submission.referred') {
      return {
        kind: 'event',
        event,
        subtitle: `to ${event.reviewer} · ${event.urgency}`,
      };
    }
    if (event.kind === 'submission.declined') {
      return {
        kind: 'event',
        event,
        subtitle: event.reasonCategory,
      };
    }
    if (event.kind === 'rating.completed') {
      return {
        kind: 'event',
        event,
        subtitle: `£${event.premium.toLocaleString()} · ${event.tier} ${event.version} · ${event.sha}`,
      };
    }
    if (event.kind === 'slip.generated') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.slipRef} · £${event.premium.toLocaleString()}`,
      };
    }
    if (event.kind === 'email.drafted') {
      return { kind: 'event', event, subtitle: event.recipient };
    }
    if (event.kind === 'quote.sent') {
      return {
        kind: 'event',
        event,
        subtitle: `to ${event.recipient}`,
      };
    }
    if (event.kind === 'quote.markedStale') {
      return { kind: 'event', event, subtitle: event.reason };
    }
    if (event.kind === 'recommendation.completed') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.primary.toUpperCase()} · ${event.confidence} confidence`,
      };
    }
    if (event.kind === 'recommendation.verdictChanged') {
      return {
        kind: 'event',
        event,
        subtitle: `${event.from.toUpperCase()} → ${event.to.toUpperCase()}`,
      };
    }
    if (event.kind === 'recommendation.actedUpon') {
      return {
        kind: 'event',
        event,
        subtitle: event.action,
      };
    }
    return { kind: 'event', event };
  });
}

type Props = {
  side?: 'left' | 'right';
  width?: number;
};

const RAIL_LIMIT = 8;

export function DecisionTrail({ side = 'left', width = 296 }: Props = {}) {
  const log = useRanBerri((s) => s.auditLog);
  const artifacts = useRanBerri((s) => s.artifacts);
  const submission = useRanBerri((s) => s.submission);
  const setAuditLogOpen = useRanBerri((s) => s.setAuditLogOpen);
  const borderClass = side === 'right' ? 'hairline-l' : 'hairline-r';

  // Module 13 — relevance-ranked truncation. The full chronology
  // remains available via "see all N events →" (which opens module
  // 8's AuditLogInspector) and via the history icon in TopBar.
  const allEntries = aggregate(log);
  const totalCount = allEntries.length;
  const entries =
    totalCount <= RAIL_LIMIT ? allEntries : pickRelevantEntries(allEntries, RAIL_LIMIT);

  const pendingArtifacts = submission
    ? ALL_ARTIFACTS.filter((k) => artifacts[k].computedAt === null)
    : [];

  return (
    <aside
      className={borderClass}
      style={{
        width,
        flex: `0 0 ${width}px`,
        background: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        className="hairline-b flex items-center justify-between"
        style={{ padding: '12px 16px', height: 44, flex: '0 0 auto' }}
      >
        <div className="eyebrow">decision trail</div>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.06em',
          }}
        >
          {entries.length} events
        </span>
      </div>

      <div style={{ padding: '12px 16px 8px', flex: '0 0 auto' }}>
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 11.5,
            color: 'var(--color-ink-mute)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          every meaningful state transition, in order.
        </p>
        {totalCount > RAIL_LIMIT && (
          <p
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 11,
              color: 'var(--color-ink-faint)',
              margin: '6px 0 0',
              letterSpacing: '-0.005em',
            }}
          >
            showing <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.04em' }}>{entries.length}</span> of <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.04em' }}>{totalCount}</span> events
          </p>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        {entries.length === 0 && pendingArtifacts.length === 0 ? (
          <EmptyTrail />
        ) : (
          <ol
            className="relative"
            style={{ listStyle: 'none', padding: 0, margin: 0 }}
          >
            <div
              className="absolute"
              style={{
                left: 6,
                top: 4,
                bottom: 4,
                width: 0.5,
                background: 'var(--color-rule)',
              }}
              aria-hidden
            />
            {entries.map((entry, i) => (
              <EventRow key={i} entry={entry} />
            ))}
            {pendingArtifacts.map((k) => (
              <PendingRow key={`p-${k}`} artifact={k} />
            ))}
          </ol>
        )}
        {totalCount > RAIL_LIMIT && (
          <button
            type="button"
            onClick={() => setAuditLogOpen(true)}
            className="serif"
            style={{
              marginTop: 14,
              padding: '6px 0',
              background: 'transparent',
              border: 0,
              color: 'var(--color-accent)',
              fontStyle: 'italic',
              fontSize: 12,
              cursor: 'pointer',
              letterSpacing: '-0.005em',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textUnderlineOffset: 3,
              textDecorationColor: 'var(--color-accent)',
            }}
          >
            see all {totalCount} events →
          </button>
        )}
      </div>

      <div
        className="hairline-t"
        style={{
          padding: '10px 16px',
          flex: '0 0 auto',
          background: 'var(--color-bg)',
        }}
      >
        <p
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 11.5,
            color: 'var(--color-ink-faint)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          audit trail as the spine
        </p>
      </div>
    </aside>
  );
}

/**
 * Module 13 relevance picker. Operates on the already-aggregated
 * EventEntry list (so we keep all the subtitle annotation work the
 * aggregate() pass produced) and selects up to `limit` entries
 * weighted by milestone status + recency.
 */
const MILESTONE_KINDS: ReadonlySet<AuditEvent['kind']> = new Set([
  'bind.committed',
  'bind.ceremonyStarted',
  'mta.committed',
  'mta.requestReceived',
  'cancellation.committed',
  'cancellation.requestReceived',
  'renewal.committed',
  'renewal.triggered',
  'quote.sent',
  'schedule.sent',
  'schedule.generated',
  'rating.completed',
  'recommendation.completed',
  'triage.completed',
  'extraction.completed',
  'submission.created',
]);

function pickRelevantEntries(entries: EventEntry[], limit: number): EventEntry[] {
  const milestones = entries.filter((e) => MILESTONE_KINDS.has(e.event.kind));
  const others = entries.filter((e) => !MILESTONE_KINDS.has(e.event.kind));
  // Take all milestones up to limit; backfill with the most-recent
  // non-milestone entries.
  const taken = new Set<string>();
  const out: EventEntry[] = [];
  for (let i = milestones.length - 1; i >= 0 && out.length < limit; i--) {
    const e = milestones[i]!;
    if (!taken.has(e.event.id)) {
      out.push(e);
      taken.add(e.event.id);
    }
  }
  for (let i = others.length - 1; i >= 0 && out.length < limit; i--) {
    const e = others[i]!;
    if (!taken.has(e.event.id)) {
      out.push(e);
      taken.add(e.event.id);
    }
  }
  // Re-sort chronologically newest-first.
  out.sort((a, b) => new Date(b.event.at).getTime() - new Date(a.event.at).getTime());
  return out;
}

function EventRow({ entry }: { entry: EventEntry }) {
  const evt = entry.event;
  const tone = dotTone(evt.kind);
  return (
    <li className="relative" style={{ paddingLeft: 22, paddingBottom: 14 }}>
      <span
        className="absolute"
        style={{
          left: 2,
          top: 5,
          width: 9,
          height: 9,
          borderRadius: 999,
          background: tone,
          border: `0.5px solid ${tone}`,
        }}
        aria-hidden
      />
      <div
        className="flex items-baseline justify-between"
        style={{ fontSize: 12, color: 'var(--color-ink)' }}
      >
        <span style={{ fontWeight: 500 }}>{KIND_LABEL[evt.kind]}</span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.04em',
          }}
        >
          {formatTime(evt.at)}
        </span>
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 11.5,
          color: 'var(--color-ink-mute)',
          marginTop: 2,
        }}
      >
        {entry.subtitle ?? formatActor(evt.actor)}
      </div>
    </li>
  );
}

function PendingRow({ artifact }: { artifact: ArtifactKey }) {
  return (
    <li
      className="relative"
      style={{ paddingLeft: 22, paddingBottom: 12, opacity: 0.7 }}
    >
      <span
        className="absolute"
        style={{
          left: 2,
          top: 5,
          width: 9,
          height: 9,
          borderRadius: 999,
          background: 'var(--color-surface)',
          border: '0.5px solid var(--color-rule-mid)',
        }}
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span
          style={{
            fontSize: 12,
            color: 'var(--color-ink-mute)',
          }}
        >
          {ARTIFACT_LABEL[artifact]}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.04em',
          }}
        >
          pending
        </span>
      </div>
    </li>
  );
}

function EmptyTrail() {
  return (
    <div
      className="hairline"
      style={{
        marginTop: 4,
        padding: '14px 14px',
        borderRadius: 'var(--radius-card)',
        borderStyle: 'dashed',
        background: 'var(--color-bg)',
      }}
    >
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: 'var(--color-ink-mute)',
          lineHeight: 1.5,
        }}
      >
        Awaiting first event. The trail begins when a submission is received.
      </div>
    </div>
  );
}
