import type { AuditEvent } from '@/lib/audit';
import type { Submission } from '@/lib/fixtures/types';
import type { SourceResult } from '@/lib/fixtures';
import type { Field, SystemExtracted } from '@/lib/field';
import { extractField } from '@/lib/field';
import { isField, type ArtifactKey } from '@/lib/deps';
import { getAtPath, setAtPath } from '@/lib/paths';

/**
 * Reconstruct cockpit state from the audit log.
 *
 * The log is the canonical persistence form; the materialised state
 * in the store is derived. Replay is pure and deterministic: same log
 * in &rarr; same state out.
 *
 * Module 3 adds enrichment + conflict + gap state. Source results,
 * conflict resolutions, and gap resolutions are all reconstructed
 * from their respective events.
 */

export type ArtifactState = {
  computedAt: string | null;
  /** Set when an artifact transitions from computed → stale. */
  staleSince: string | null;
};

export type IntakeReplayState = {
  phase: 'idle' | 'receiving' | 'reading' | 'extracting' | 'complete';
  fieldCount: number | null;
  avgConfidence: number | null;
  completedAt: string | null;
};

// ---------- enrichment-derived state ----------

export type SourceStatus = {
  id: string;
  name: string;
  status: 'idle' | 'querying' | 'returned';
  result: SourceResult | null;
  /** Wall-clock ms latency captured from the sourceReturned event. */
  latencyMs: number | null;
  queriedAt: string | null;
  returnedAt: string | null;
};

export type ConflictRecord = {
  id: string;
  fieldPath: string;
  brokerValue: unknown;
  brokerSourceRef: string;
  externalSource: string;
  externalValue: unknown;
  externalSourceRef: string;
  marginalia: string;
  detectedAt: string;
  resolution: ConflictResolution | null;
  /**
   * Set to true when the engine has determined the conflict no
   * longer manifests (e.g. broker value reconciled with external).
   * Cleared when re-detection re-establishes the conflict, at which
   * point any prior resolution carries over.
   */
  dismissed: boolean;
};

export type ConflictResolution = {
  choice: 'broker' | 'external' | 'custom';
  value: unknown;
  reason: string;
  resolvedBy: string;
  resolvedAt: string;
};

export type GapRecord = {
  id: string;
  fieldPath: string;
  description: string;
  detectedAt: string;
  resolution: GapResolution | null;
  /** A 'request' resolution adds a gap.requestSent event with this. */
  requestSent: { recipient: string; queuedAt: string } | null;
  /** Mirror of ConflictRecord.dismissed; set when the gap is reconciled. */
  dismissed: boolean;
};

export type GapResolution = {
  choice: 'present' | 'absent' | 'request';
  value: boolean | null;
  reason: string;
  resolvedBy: string;
  resolvedAt: string;
};

export type EnrichmentReplayState = {
  phase: 'idle' | 'querying' | 'reconciling' | 'settled';
  sources: Record<string, SourceStatus>;
  conflicts: ConflictRecord[];
  gaps: GapRecord[];
  /** Wall-clock when enrichment.completed last fired. */
  completedAt: string | null;
  /** Conflict count at last completion (for the byline). */
  conflictCountAtSettle: number;
  gapCountAtSettle: number;
};

// ---------- triage-derived state ----------

export type TriageCheckId =
  | 'appetite'
  | 'capacity'
  | 'subjectivities'
  | 'sanctions';

export type TriageOutcome = 'pass' | 'refer' | 'decline';

export type TriageCheckRecord = {
  id: TriageCheckId;
  outcome: TriageOutcome;
  rationale: string;
  ruleIds: string[];
  rules: Array<{
    ruleId: string;
    description: string;
    passed: boolean;
    testedValue?: string;
  }>;
  evaluatedAt: string;
  metadata?: unknown;
  override: {
    outcome: TriageOutcome;
    reason: string;
    overriddenBy: string;
    overriddenAt: string;
  } | null;
};

export type TriageReplayState = {
  phase: 'idle' | 'evaluating' | 'settled';
  checks: TriageCheckRecord[];
  /** Overall verdict at last `triage.completed`. */
  verdict: TriageOutcome | null;
  completedAt: string | null;
  /** Set when the most recent `triage.completed` differs from the previous. */
  lastVerdictChange: { from: TriageOutcome; to: TriageOutcome; cause: string } | null;
};

export function freshTriage(): TriageReplayState {
  return {
    phase: 'idle',
    checks: [],
    verdict: null,
    completedAt: null,
    lastVerdictChange: null,
  };
}

// ---------- submission lifecycle state ----------

export type SubmissionLifecycleState =
  | 'active'
  | 'rating-pending'
  | 'referred'
  | 'declined';

export type ReferralRecord = {
  reviewer: string;
  urgency: 'today' | 'week' | 'next-available';
  reason: string;
  referredBy: string;
  referredAt: string;
  recalledAt: string | null;
  recalledBy: string | null;
};

export type DeclineRecord = {
  reasonCategory: string;
  detail: string;
  notifyBroker: boolean;
  declinedBy: string;
  declinedAt: string;
};

export type ReplayResult = {
  submission: Submission | null;
  artifacts: Record<ArtifactKey, ArtifactState>;
  intake: IntakeReplayState;
  enrichment: EnrichmentReplayState;
  triage: TriageReplayState;
  submissionState: SubmissionLifecycleState;
  referral: ReferralRecord | null;
  decline: DeclineRecord | null;
};

export function freshArtifacts(): Record<ArtifactKey, ArtifactState> {
  return {
    enrichment: { computedAt: null, staleSince: null },
    conflicts: { computedAt: null, staleSince: null },
    triage: { computedAt: null, staleSince: null },
    rating: { computedAt: null, staleSince: null },
    quote: { computedAt: null, staleSince: null },
    recommendation: { computedAt: null, staleSince: null },
  };
}

const ALL_ARTIFACTS: readonly ArtifactKey[] = [
  'enrichment',
  'conflicts',
  'triage',
  'rating',
  'quote',
  'recommendation',
];

function freshIntake(): IntakeReplayState {
  return {
    phase: 'idle',
    fieldCount: null,
    avgConfidence: null,
    completedAt: null,
  };
}

export function freshEnrichment(): EnrichmentReplayState {
  return {
    phase: 'idle',
    sources: {},
    conflicts: [],
    gaps: [],
    completedAt: null,
    conflictCountAtSettle: 0,
    gapCountAtSettle: 0,
  };
}

export function replay(events: AuditEvent[]): ReplayResult {
  let submission: Submission | null = null;
  const artifacts = freshArtifacts();
  const intake = freshIntake();
  const enrichment = freshEnrichment();
  const triage = freshTriage();
  let submissionState: SubmissionLifecycleState = 'active';
  let referral: ReferralRecord | null = null;
  let decline: DeclineRecord | null = null;

  for (const e of events) {
    switch (e.kind) {
      case 'email.received':
        if (intake.phase === 'idle') intake.phase = 'receiving';
        break;

      case 'submission.created':
        submission = structuredClone(e.submission);
        if (intake.phase === 'idle') intake.phase = 'receiving';
        break;

      case 'extraction.started':
        intake.phase = 'extracting';
        break;

      case 'extraction.fieldExtracted':
        if (submission) {
          applyExtraction(submission, e.fieldPath, e.value, {
            confidence: e.confidence,
            sourceRef: e.sourceRef,
            extractedAt: e.extractedAt,
            modelVersion: e.modelVersion,
          });
        }
        break;

      case 'extraction.completed':
        intake.phase = 'complete';
        intake.fieldCount = e.fieldCount;
        intake.avgConfidence = e.avgConfidence;
        intake.completedAt = e.at;
        break;

      case 'extraction.rerun':
        // Marker only; subsequent submission.created replaces state.
        break;

      case 'field.corrected':
        if (submission) {
          const cur = getAtPath(submission, e.fieldPath);
          if (isField(cur)) {
            setAtPath(submission, e.fieldPath, {
              ...cur,
              underwriterCorrected: {
                value: e.value,
                reason: e.reason,
                correctedBy: e.correctedBy,
                correctedAt: e.at,
              },
            });
          }
        }
        break;

      // ---------- enrichment ----------

      case 'enrichment.started':
        enrichment.phase = 'querying';
        break;

      case 'enrichment.sourceQueried':
        enrichment.sources[e.source] = {
          id: e.source,
          name: e.source,
          status: 'querying',
          result: null,
          latencyMs: null,
          queriedAt: e.at,
          returnedAt: null,
        };
        break;

      case 'enrichment.sourceReturned':
        enrichment.sources[e.source] = {
          id: e.source,
          name: e.source,
          status: 'returned',
          result: e.payload as SourceResult,
          latencyMs: e.latencyMs,
          queriedAt: enrichment.sources[e.source]?.queriedAt ?? null,
          returnedAt: e.at,
        };
        break;

      case 'enrichment.completed':
        enrichment.phase = 'settled';
        enrichment.completedAt = e.at;
        enrichment.conflictCountAtSettle = e.conflictCount;
        enrichment.gapCountAtSettle = e.gapCount;
        break;

      case 'enrichment.rerun':
        // Reset enrichment-derived state. Subsequent enrichment.started
        // and source events re-establish it. Conflicts and gaps already
        // resolved are preserved and re-attached when subsequent
        // detection events fire.
        enrichment.phase = 'idle';
        enrichment.sources = {};
        // conflicts / gaps stay — preserved resolutions need to live
        // through the rerun until subsequent conflict.detected /
        // gap.detected events overwrite them.
        break;

      case 'conflict.detected': {
        const existing = enrichment.conflicts.find((c) => c.id === e.conflictId);
        const next: ConflictRecord = {
          id: e.conflictId,
          fieldPath: e.fieldPath,
          brokerValue: e.brokerValue,
          brokerSourceRef: e.brokerSourceRef,
          externalSource: e.externalSource,
          externalValue: e.externalValue,
          externalSourceRef: e.externalSourceRef,
          marginalia: e.marginalia,
          detectedAt: e.at,
          resolution: existing?.resolution ?? null,
          // Re-detection un-dismisses; if the conflict is back, it's
          // active again (resolution preserved).
          dismissed: false,
        };
        if (existing) {
          enrichment.conflicts = enrichment.conflicts.map((c) =>
            c.id === e.conflictId ? next : c,
          );
        } else {
          enrichment.conflicts.push(next);
        }
        break;
      }

      case 'conflict.resolved': {
        const idx = enrichment.conflicts.findIndex((c) => c.id === e.conflictId);
        if (idx >= 0) {
          enrichment.conflicts[idx] = {
            ...enrichment.conflicts[idx]!,
            resolution: {
              choice: e.choice,
              value: e.value,
              reason: e.reason,
              resolvedBy: e.resolvedBy,
              resolvedAt: e.at,
            },
          };
        }
        break;
      }

      case 'conflict.dismissed': {
        const idx = enrichment.conflicts.findIndex((c) => c.id === e.conflictId);
        if (idx >= 0) {
          enrichment.conflicts[idx] = {
            ...enrichment.conflicts[idx]!,
            dismissed: true,
          };
        }
        break;
      }

      case 'gap.detected': {
        const existing = enrichment.gaps.find((g) => g.id === e.gapId);
        const next: GapRecord = {
          id: e.gapId,
          fieldPath: e.fieldPath,
          description: e.description,
          detectedAt: e.at,
          resolution: existing?.resolution ?? null,
          requestSent: existing?.requestSent ?? null,
          dismissed: false,
        };
        if (existing) {
          enrichment.gaps = enrichment.gaps.map((g) =>
            g.id === e.gapId ? next : g,
          );
        } else {
          enrichment.gaps.push(next);
        }
        break;
      }

      case 'gap.resolved': {
        const idx = enrichment.gaps.findIndex((g) => g.id === e.gapId);
        if (idx >= 0) {
          enrichment.gaps[idx] = {
            ...enrichment.gaps[idx]!,
            resolution: {
              choice: e.choice,
              value: e.value,
              reason: e.reason,
              resolvedBy: e.resolvedBy,
              resolvedAt: e.at,
            },
          };
        }
        break;
      }

      case 'gap.dismissed': {
        const idx = enrichment.gaps.findIndex((g) => g.id === e.gapId);
        if (idx >= 0) {
          enrichment.gaps[idx] = {
            ...enrichment.gaps[idx]!,
            dismissed: true,
          };
        }
        break;
      }

      case 'gap.requestSent': {
        const idx = enrichment.gaps.findIndex((g) => g.id === e.gapId);
        if (idx >= 0) {
          enrichment.gaps[idx] = {
            ...enrichment.gaps[idx]!,
            requestSent: { recipient: e.recipient, queuedAt: e.at },
          };
        }
        break;
      }

      case 'artifact.computed':
        if (isArtifactKey(e.artifact)) {
          artifacts[e.artifact].computedAt = e.computedAt;
          artifacts[e.artifact].staleSince = null;
        }
        break;

      case 'artifact.stale':
        if (isArtifactKey(e.artifact)) {
          artifacts[e.artifact].computedAt = null;
          artifacts[e.artifact].staleSince = e.at;
        }
        break;

      // ---------- triage ----------

      case 'triage.started':
        triage.phase = 'evaluating';
        triage.checks = [];
        triage.lastVerdictChange = null;
        break;

      case 'triage.checkEvaluated': {
        const idx = triage.checks.findIndex((c) => c.id === e.check);
        const next: TriageCheckRecord = {
          id: e.check,
          outcome: e.outcome,
          rationale: e.rationale,
          ruleIds: e.ruleIds,
          rules: e.rules,
          evaluatedAt: e.at,
          metadata: e.metadata,
          override: idx >= 0 ? triage.checks[idx]!.override : null,
        };
        if (idx >= 0) triage.checks[idx] = next;
        else triage.checks.push(next);
        break;
      }

      case 'triage.completed':
        triage.phase = 'settled';
        triage.completedAt = e.at;
        triage.verdict = e.verdict;
        break;

      case 'triage.verdictChanged':
        triage.lastVerdictChange = { from: e.from, to: e.to, cause: e.cause };
        break;

      case 'triage.rerun':
        triage.phase = 'idle';
        triage.checks = [];
        triage.verdict = null;
        triage.lastVerdictChange = null;
        break;

      case 'triage.checkOverridden': {
        const idx = triage.checks.findIndex((c) => c.id === e.check);
        if (idx >= 0) {
          triage.checks[idx]!.override = {
            outcome: e.to,
            reason: e.reason,
            overriddenBy: e.overriddenBy,
            overriddenAt: e.at,
          };
        }
        break;
      }

      case 'triage.passedToRating':
        submissionState = 'rating-pending';
        break;

      case 'submission.referred':
        submissionState = 'referred';
        referral = {
          reviewer: e.reviewer,
          urgency: e.urgency,
          reason: e.reason,
          referredBy: e.referredBy,
          referredAt: e.at,
          recalledAt: null,
          recalledBy: null,
        };
        break;

      case 'submission.recalled':
        if (referral !== null) {
          const prev: ReferralRecord = referral;
          referral = {
            reviewer: prev.reviewer,
            urgency: prev.urgency,
            reason: prev.reason,
            referredBy: prev.referredBy,
            referredAt: prev.referredAt,
            recalledAt: e.at,
            recalledBy: e.recalledBy,
          };
        }
        submissionState = 'active';
        break;

      case 'submission.declined':
        submissionState = 'declined';
        decline = {
          reasonCategory: e.reasonCategory,
          detail: e.detail,
          notifyBroker: e.notifyBroker,
          declinedBy: e.declinedBy,
          declinedAt: e.at,
        };
        break;

      // Pass-through:
      case 'submission.received':
      case 'gap.flagged':
      case 'conflict.flagged':
      case 'rating.computed':
      case 'quote.issued':
      case 'recommendation.generated':
      case 'decision.recorded':
        break;
    }
  }

  return {
    submission,
    artifacts,
    intake,
    enrichment,
    triage,
    submissionState,
    referral,
    decline,
  };
}

function isArtifactKey(s: string): s is ArtifactKey {
  return (ALL_ARTIFACTS as readonly string[]).includes(s);
}

/**
 * Apply an extracted value at a path on the submission tree.
 *
 *   - If the path resolves to a Field<T>, set systemExtracted on it.
 *   - If the path resolves to an aggregate (e.g. `sites`), walk into
 *     the structure and apply each leaf accordingly.
 *
 * Mutates `submission` in place.
 */
export function applyExtraction(
  submission: Submission,
  path: string,
  value: unknown,
  meta: Omit<SystemExtracted<unknown>, 'value'>,
): void {
  const node = getAtPath(submission, path);
  if (isField(node)) {
    setAtPath(
      submission,
      path,
      extractField(node as Field<unknown>, {
        value,
        confidence: meta.confidence,
        sourceRef: meta.sourceRef,
        extractedAt: meta.extractedAt,
        modelVersion: meta.modelVersion,
      }),
    );
    return;
  }
  if (Array.isArray(node) && Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const sub = value[i];
      if (sub && typeof sub === 'object') {
        for (const [key, v] of Object.entries(sub as Record<string, unknown>)) {
          applyExtraction(submission, `${path}[${i}].${key}`, v, meta);
        }
      }
    }
    return;
  }
}
