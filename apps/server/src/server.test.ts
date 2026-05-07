import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { openDb, type DbHandle } from './db.js';

let db: DbHandle;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  // In-memory SQLite — no disk side effects between test runs.
  db = openDb(':memory:');
  app = createApp(db, { silent: true });
});

afterAll(() => {
  db.close();
});

async function fetchJson(req: Request): Promise<{ status: number; body: unknown }> {
  const res = await app.fetch(req);
  return { status: res.status, body: await res.json() };
}

describe('paslite-server', () => {
  it('GET /health returns ok', async () => {
    const res = await app.fetch(new Request('http://test/health'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('paslite-server');
  });

  it('POST /events appends and assigns monotonic ids', async () => {
    const { status, body } = await fetchJson(
      new Request('http://test/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submissionId: 'sub_smoke_1',
          events: [
            { id: 'evt-1', kind: 'submission.received', at: '2027-05-09T08:00:00Z' },
            { id: 'evt-2', kind: 'extraction.started', at: '2027-05-09T08:00:01Z' },
          ],
        }),
      }),
    );
    expect(status).toBe(201);
    const r = body as { appended: number; firstId: number; lastId: number };
    expect(r.appended).toBe(2);
    expect(r.firstId).toBe(1);
    expect(r.lastId).toBe(2);
  });

  it('GET /events?since=N returns events with id > N for the submission', async () => {
    const { status, body } = await fetchJson(
      new Request('http://test/events?submissionId=sub_smoke_1&since=0'),
    );
    expect(status).toBe(200);
    const r = body as {
      events: Array<{ id: string; kind: string; _serverId: number }>;
      highWaterMark: number;
    };
    expect(r.events.length).toBe(2);
    expect(r.events[0]!.id).toBe('evt-1');
    expect(r.events[0]!._serverId).toBe(1);
    expect(r.events[1]!.id).toBe('evt-2');
    expect(r.events[1]!._serverId).toBe(2);
    expect(r.highWaterMark).toBe(2);
  });

  it('GET /events?since=N filters by high-water-mark for incremental replay', async () => {
    // Append two more events on the same submission.
    await app.fetch(
      new Request('http://test/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submissionId: 'sub_smoke_1',
          events: [
            { id: 'evt-3', kind: 'extraction.completed', at: '2027-05-09T08:00:02Z' },
            { id: 'evt-4', kind: 'enrichment.started', at: '2027-05-09T08:00:03Z' },
          ],
        }),
      }),
    );
    // Since the previous high-water-mark of 2.
    const { body } = await fetchJson(
      new Request('http://test/events?submissionId=sub_smoke_1&since=2'),
    );
    const r = body as {
      events: Array<{ id: string }>;
      highWaterMark: number;
    };
    expect(r.events.length).toBe(2);
    expect(r.events.map((e) => e.id)).toEqual(['evt-3', 'evt-4']);
    expect(r.highWaterMark).toBe(4);
  });

  it('events are scoped to submissionId', async () => {
    await app.fetch(
      new Request('http://test/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submissionId: 'sub_smoke_2',
          events: [
            { id: 'other-1', kind: 'submission.received', at: '2027-05-09T09:00:00Z' },
          ],
        }),
      }),
    );
    const { body: bodyA } = await fetchJson(
      new Request('http://test/events?submissionId=sub_smoke_1&since=0'),
    );
    const { body: bodyB } = await fetchJson(
      new Request('http://test/events?submissionId=sub_smoke_2&since=0'),
    );
    expect((bodyA as { events: unknown[] }).events.length).toBe(4);
    expect((bodyB as { events: unknown[] }).events.length).toBe(1);
  });

  it('GET /events/count returns the per-submission total', async () => {
    const { status, body } = await fetchJson(
      new Request('http://test/events/count?submissionId=sub_smoke_1'),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ submissionId: 'sub_smoke_1', count: 4 });
  });

  it('rejects malformed POST bodies', async () => {
    const cases: Array<{ body: unknown; reason: string }> = [
      { body: {}, reason: 'no submissionId' },
      { body: { submissionId: 'x' }, reason: 'no events array' },
      { body: { submissionId: 'x', events: [] }, reason: 'empty events' },
      {
        body: {
          submissionId: 'x',
          events: [{ kind: 'foo', at: '2027-01-01T00:00:00Z' }],
        },
        reason: 'event missing id',
      },
    ];
    for (const { body, reason } of cases) {
      const res = await app.fetch(
        new Request('http://test/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      expect(res.status, reason).toBe(400);
    }
  });

  it('rejects GET without submissionId', async () => {
    const res = await app.fetch(new Request('http://test/events'));
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await app.fetch(new Request('http://test/nonexistent'));
    expect(res.status).toBe(404);
  });

  it('preserves the full event payload through the round-trip', async () => {
    const richEvent = {
      id: 'evt-bind-1',
      kind: 'bind.committed',
      at: '2027-05-09T10:00:00Z',
      actor: { kind: 'underwriter', id: 'nm' },
      policyRef: 'POL-29481',
      premium: 38_265,
      signedBy: 'nm',
      hashes: ['sha-7f2a', 'sha-8e1b'],
    };
    await app.fetch(
      new Request('http://test/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submissionId: 'sub_rich',
          events: [richEvent],
        }),
      }),
    );
    const { body } = await fetchJson(
      new Request('http://test/events?submissionId=sub_rich&since=0'),
    );
    const stored = (body as { events: typeof richEvent[] }).events[0]!;
    expect(stored.id).toBe(richEvent.id);
    expect(stored.kind).toBe(richEvent.kind);
    expect(stored.policyRef).toBe(richEvent.policyRef);
    expect(stored.premium).toBe(38_265);
    expect(stored.actor).toEqual(richEvent.actor);
    expect(stored.hashes).toEqual(richEvent.hashes);
  });
});
