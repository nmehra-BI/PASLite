import { useRanBerri } from '@/store';
import {
  ENRICHMENT_SOURCES,
  SOURCE_QUERIES,
  type EnrichmentSourceId,
  type SourceResult,
} from '@/lib/fixtures';
import { detectConflicts, detectGaps } from '@/lib/conflict';

const SUBMISSION_ID = 'sub_greenline_2026_05';

/**
 * The enrichment cinematic. Fires the four mock source queries in
 * parallel; each one emits its sourceQueried event up-front and
 * sourceReturned when its mock latency elapses. After all return,
 * detectConflicts and detectGaps emit conflict.detected / gap.detected
 * events, then enrichment.completed and an artifact.computed pair for
 * `enrichment` and `conflicts`.
 *
 * Re-running preserves any already-resolved conflicts/gaps: we count
 * them up-front, emit `enrichment.rerun` with the count, then re-fire
 * the queries. The original `conflict.resolved` / `gap.resolved`
 * events stay in the log; the new `conflict.detected` events overwrite
 * the detection metadata but replay preserves the prior resolution.
 */
export async function runEnrichment(opts?: { rerun?: boolean }): Promise<void> {
  const main = useRanBerri.getState();
  const submission = main.submission;
  if (!submission) return;

  const startAt = new Date().toISOString();

  // Count existing resolutions for the rerun marker.
  let preservedResolutions = 0;
  if (opts?.rerun) {
    const enrichment = main.enrichment;
    preservedResolutions =
      enrichment.conflicts.filter((c) => c.resolution !== null).length +
      enrichment.gaps.filter((g) => g.resolution !== null).length;
    main.appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'enrichment.rerun',
      submissionId: SUBMISSION_ID,
      preservedResolutions,
    });
  }

  main.appendAuditEvent({
    actor: { kind: 'system' },
    at: startAt,
    kind: 'enrichment.started',
    submissionId: SUBMISSION_ID,
  });

  // Fire all four queries in parallel; each one emits its own
  // queried/returned pair as it lands.
  const results = await Promise.all(
    ENRICHMENT_SOURCES.map((meta) => runSingleSource(meta.id)),
  );

  // ---- detection ----
  // Refresh the submission reference: corrections may have landed during
  // the cinematic if the user clicked through fast (unlikely but cheap).
  const fresh = useRanBerri.getState().submission ?? submission;
  const conflicts = detectConflicts(fresh, results);
  const structuralGaps = detectGaps(fresh);

  // Snapshot the prior state BEFORE we emit detection events. We use
  // this to compute the dismissal diff: any conflict / gap that was
  // active before this pass and is no longer active after detection
  // gets a dismissed event.
  const prior = useRanBerri.getState().enrichment;
  const priorActiveConflictIds = new Set(
    prior.conflicts.filter((c) => !c.dismissed).map((c) => c.id),
  );
  const priorActiveGapIds = new Set(
    prior.gaps.filter((g) => !g.dismissed).map((g) => g.id),
  );
  const priorResolvedGapIds = new Set(
    prior.gaps.filter((g) => g.resolution !== null && !g.dismissed).map((g) => g.id),
  );

  // Emit conflict.detected for every active conflict. Replay
  // re-attaches any prior resolution that lives in the log.
  for (const c of conflicts) {
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'conflict.detected',
      submissionId: SUBMISSION_ID,
      conflictId: c.id,
      fieldPath: c.fieldPath,
      brokerValue: c.brokerValue,
      brokerSourceRef: c.brokerSourceRef,
      externalSource: c.externalSource,
      externalValue: c.externalValue,
      externalSourceRef: c.externalSourceRef,
      marginalia: c.marginalia,
    });
  }

  // Emit gap.detected only for structural gaps that don't carry a
  // prior resolution (e.g. 'request' resolutions don't populate the
  // underwriter layer; we don't want to re-detect them every pass).
  for (const g of structuralGaps) {
    if (priorResolvedGapIds.has(g.id)) continue;
    useRanBerri.getState().appendAuditEvent({
      actor: { kind: 'system' },
      kind: 'gap.detected',
      submissionId: SUBMISSION_ID,
      gapId: g.id,
      fieldPath: g.fieldPath,
      description: g.description,
    });
  }

  // ---- dismissal diff ----
  const newConflictIds = new Set(conflicts.map((c) => c.id));
  for (const id of priorActiveConflictIds) {
    if (!newConflictIds.has(id)) {
      useRanBerri.getState().appendAuditEvent({
        actor: { kind: 'system' },
        kind: 'conflict.dismissed',
        submissionId: SUBMISSION_ID,
        conflictId: id,
        reason: 'no longer detected — broker value reconciled with external source',
      });
    }
  }

  const newGapIds = new Set(structuralGaps.map((g) => g.id));
  for (const id of priorActiveGapIds) {
    if (!newGapIds.has(id)) {
      useRanBerri.getState().appendAuditEvent({
        actor: { kind: 'system' },
        kind: 'gap.dismissed',
        submissionId: SUBMISSION_ID,
        gapId: id,
        reason: 'no longer detected — field has been populated',
      });
    }
  }

  // ---- completion ----
  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'enrichment.completed',
    submissionId: SUBMISSION_ID,
    sources: ENRICHMENT_SOURCES.map((s) => s.id),
    conflictCount: conflicts.length,
    gapCount: structuralGaps.filter((g) => !priorResolvedGapIds.has(g.id))
      .length,
  });

  // Mark both enrichment and conflicts artifacts as computed. Rating /
  // quote / recommendation stay stale until those modules run.
  useRanBerri.getState().markArtifactComputed('enrichment');
  useRanBerri.getState().markArtifactComputed('conflicts');
}

async function runSingleSource(id: EnrichmentSourceId): Promise<SourceResult> {
  const main = useRanBerri.getState();
  const queryRef = `q_${id}_${Date.now().toString(36)}`;
  const queriedAt = new Date().toISOString();

  main.appendAuditEvent({
    actor: { kind: 'system' },
    at: queriedAt,
    kind: 'enrichment.sourceQueried',
    submissionId: SUBMISSION_ID,
    source: id,
    queryRef,
  });

  const start = Date.now();
  const result = await SOURCE_QUERIES[id](queriedAt);
  const latencyMs = Date.now() - start;

  useRanBerri.getState().appendAuditEvent({
    actor: { kind: 'system' },
    kind: 'enrichment.sourceReturned',
    submissionId: SUBMISSION_ID,
    source: id,
    queryRef,
    latencyMs,
    payload: result,
    summary: result.summary,
    verdict: result.verdict,
  });

  return result;
}
