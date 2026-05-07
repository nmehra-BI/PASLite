import { describe, expect, it } from 'vitest';
import { getRelevantEvents } from './getRelevantEvents';
import type { AuditEvent } from './types';

let counter = 0;
const id = () => `e${counter++}`;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function ev(partial: Record<string, unknown>): AuditEvent {
  return { id: id(), at: at(0), actor: { kind: 'system' }, ...partial } as AuditEvent;
}

describe('getRelevantEvents', () => {
  it('returns the full log unchanged when below the limit', () => {
    const log: AuditEvent[] = [
      ev({ kind: 'submission.created', at: at(-3000), submissionId: 's', folio: 'f', broker: 'b', submission: {} }),
      ev({ kind: 'extraction.completed', at: at(-2000), submissionId: 's', fieldCount: 12, avgConfidence: 0.94 }),
      ev({ kind: 'rating.completed', at: at(-1000), submissionId: 's', premium: 38265, sha: 'sha-7f2a', version: 'v3.2', tier: 'Tier-2', iteration: 1 }),
    ];
    const out = getRelevantEvents({ log, limit: 8 });
    expect(out).toHaveLength(3);
  });

  it('filters out noise kinds (extraction.fieldExtracted, rating.cellComputed, etc.)', () => {
    const log: AuditEvent[] = [];
    for (let i = 0; i < 12; i++) {
      log.push(
        ev({
          kind: 'extraction.fieldExtracted',
          submissionId: 's',
          fieldPath: `f${i}`,
          value: i,
          confidence: 0.9,
          sourceRef: 'r',
          extractedAt: at(0),
          modelVersion: 'm',
        }),
      );
    }
    log.push(
      ev({
        kind: 'extraction.completed',
        at: at(0),
        submissionId: 's',
        fieldCount: 12,
        avgConfidence: 0.94,
      }),
    );
    const out = getRelevantEvents({ log, limit: 8 });
    expect(out.every((e) => e.kind !== 'extraction.fieldExtracted')).toBe(true);
    expect(out.some((e) => e.kind === 'extraction.completed')).toBe(true);
  });

  it('always includes milestones even when older than other events', () => {
    const log: AuditEvent[] = [];
    // Old milestone
    log.push(ev({ kind: 'bind.committed', at: at(-100000), submissionId: 's', policyRef: 'POL-1', premium: 1, signedBy: 'nm', hashes: [] }));
    // Lots of recent non-milestone events
    for (let i = 0; i < 20; i++) {
      log.push(
        ev({
          kind: 'artifact.computed',
          at: at(-i),
          submissionId: 's',
          artifact: 'rating',
          computedAt: at(-i),
        }),
      );
    }
    const out = getRelevantEvents({ log, limit: 8 });
    expect(out.some((e) => e.kind === 'bind.committed')).toBe(true);
  });

  it('caps result at the limit', () => {
    const log: AuditEvent[] = [];
    for (let i = 0; i < 50; i++) {
      log.push(
        ev({
          kind: 'artifact.computed',
          at: at(-i * 1000),
          submissionId: 's',
          artifact: 'rating',
          computedAt: at(-i * 1000),
        }),
      );
    }
    const out = getRelevantEvents({ log, limit: 8 });
    expect(out).toHaveLength(8);
  });

  it('orders newest-first by at', () => {
    const log: AuditEvent[] = [
      ev({ kind: 'rating.completed', at: at(-3000), submissionId: 's', premium: 1, sha: 'sha-1', version: 'v1', tier: 't', iteration: 1 }),
      ev({ kind: 'quote.sent', at: at(-2000), submissionId: 's', slipRef: 'r', recipient: 'x', subject: 'y', body: 'b', sentBy: 'nm' }),
      ev({ kind: 'bind.committed', at: at(-1000), submissionId: 's', policyRef: 'POL-1', premium: 1, signedBy: 'nm', hashes: [] }),
    ];
    const out = getRelevantEvents({ log, limit: 8 });
    expect(out[0]!.kind).toBe('bind.committed');
    expect(out[2]!.kind).toBe('rating.completed');
  });
});
