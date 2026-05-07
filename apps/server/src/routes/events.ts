/**
 * Event-store routes. Two endpoints, one resource:
 *
 *   POST /events
 *     body: { submissionId: string, events: IncomingEvent[] }
 *     Appends; returns { appended, firstId, lastId }.
 *
 *   GET /events?submissionId=X&since=N
 *     Returns events with id > N for the given submission, in
 *     ascending id order, with a `highWaterMark` the client can
 *     pass back as `since` next time.
 */

import { Hono } from 'hono';
import type { DbHandle } from '../db.js';
import type {
  AppendRequest,
  AppendResponse,
  IncomingEvent,
  ReplayResponse,
} from '../types.js';

export function eventsRoutes(db: DbHandle) {
  const app = new Hono();

  // POST /events
  app.post('/events', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'body must be valid JSON' }, 400);
    }
    const parsed = parseAppendRequest(body);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const result = db.insertEvents(parsed.value.submissionId, parsed.value.events);
    const response: AppendResponse = {
      appended: result.appended,
      firstId: result.firstId,
      lastId: result.lastId,
    };
    return c.json(response, 201);
  });

  // GET /events
  app.get('/events', (c) => {
    const submissionId = c.req.query('submissionId');
    const sinceRaw = c.req.query('since') ?? '0';
    if (!submissionId) {
      return c.json({ error: 'submissionId query parameter is required' }, 400);
    }
    const since = Number.parseInt(sinceRaw, 10);
    if (!Number.isFinite(since) || since < 0) {
      return c.json({ error: 'since must be a non-negative integer' }, 400);
    }

    const rows = db.readEventsSince(submissionId, since);
    const events = rows.map((row) => {
      const parsed = JSON.parse(row.payload) as IncomingEvent;
      return {
        ...parsed,
        _serverId: row.id,
        _ingestedAt: row.ingestedAt,
      };
    });
    const highWaterMark =
      rows.length > 0 ? rows[rows.length - 1]!.id : since;
    const response: ReplayResponse = { events, highWaterMark };
    return c.json(response);
  });

  // GET /events/count — small ops endpoint, useful for the cockpit
  // to display "N events on file" without paying for a full replay.
  app.get('/events/count', (c) => {
    const submissionId = c.req.query('submissionId');
    if (!submissionId) {
      return c.json({ error: 'submissionId query parameter is required' }, 400);
    }
    return c.json({ submissionId, count: db.countEvents(submissionId) });
  });

  return app;
}

// ─── parsing ────────────────────────────────────────────────────────

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function parseAppendRequest(body: unknown): Result<AppendRequest> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'body must be an object' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.submissionId !== 'string' || b.submissionId.length === 0) {
    return { ok: false, error: 'submissionId must be a non-empty string' };
  }
  if (!Array.isArray(b.events)) {
    return { ok: false, error: 'events must be an array' };
  }
  if (b.events.length === 0) {
    return { ok: false, error: 'events must not be empty' };
  }
  if (b.events.length > 5000) {
    return { ok: false, error: 'events array too large (max 5000 per request)' };
  }
  for (const [i, e] of b.events.entries()) {
    if (typeof e !== 'object' || e === null) {
      return { ok: false, error: `events[${i}] must be an object` };
    }
    const ev = e as Record<string, unknown>;
    if (typeof ev.id !== 'string') {
      return { ok: false, error: `events[${i}].id must be a string` };
    }
    if (typeof ev.kind !== 'string') {
      return { ok: false, error: `events[${i}].kind must be a string` };
    }
    if (typeof ev.at !== 'string') {
      return { ok: false, error: `events[${i}].at must be a string` };
    }
  }
  return {
    ok: true,
    value: {
      submissionId: b.submissionId,
      events: b.events as IncomingEvent[],
    },
  };
}
