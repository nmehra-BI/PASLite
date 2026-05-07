# paslite-server

Append-only event store for the RanBerri cockpit. The cockpit's
canonical state is its audit log; this server persists that log so
two browsers can collaborate on the same submission and so the log
survives across machines.

This is **scope A**: a thin Node + Hono + SQLite service that
mirrors the SPA's existing data model on the wire. No auth, no
multi-tenant routing, no real external integrations. Designed to
grow into scope B (real schemas, JWT, WebSockets) without rework.

## Run it

```bash
cd apps/server
npm install
npm run dev    # tsx watch on port 3001
```

The default DB lives at `apps/server/data/paslite.db`. Override
with `PASLITE_DB=/path/to.db PORT=4000 npm run dev`.

## API

### `GET /health`
Liveness + version. Returns `{ status, service, version, time }`.

### `POST /events`
Appends one or more audit events for a submission.

```json
POST /events
{
  "submissionId": "sub_greenline_2026_05",
  "events": [
    {
      "id": "evt-001",
      "kind": "submission.received",
      "at": "2027-05-09T08:00:00Z",
      "actor": { "kind": "broker", "id": "Sarah Whitfield" },
      "..."
    }
  ]
}
```

Returns `{ appended, firstId, lastId }`. Events are stored opaquely;
the server doesn't validate domain semantics — that's the cockpit's
job.

### `GET /events?submissionId=X&since=N`
Returns events with id > N for the given submission, in ascending
id order.

```json
{
  "events": [
    { "id": "evt-001", "kind": "...", "_serverId": 1, "_ingestedAt": "..." },
    ...
  ],
  "highWaterMark": 12
}
```

Pass `highWaterMark` back as `since` for the next incremental pull.

### `GET /events/count?submissionId=X`
Returns the total event count for a submission. Useful for the
cockpit to display "N events on file" without paying for a full
replay.

## Schema

Single table:

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_event_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  at TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  payload TEXT NOT NULL  -- JSON-encoded full event
);
CREATE INDEX idx_events_submission_id ON events(submission_id, id);
CREATE INDEX idx_events_kind ON events(submission_id, kind);
```

WAL mode + `synchronous=NORMAL` for concurrent read while writers
make progress.

## Tests

```bash
npm test
```

Smoke tests use an in-memory SQLite (`:memory:`) so disk state never
leaks between runs.

## Where this is going

Scope B (production-shaped, ~3–4 weeks of work, not yet started):

- JWT auth tied to the cockpit's tenant config
- Per-resource REST endpoints (submissions, policies, MTAs, ledger)
- WebSocket channel for live cockpit updates
- Migration to typed Postgres schemas
- Bordereau export delivery integration
- Idempotency keys + dedupe (today the server allows duplicate
  inserts of the same client_event_id; cockpit replays this is
  fine, but a real client would want at-least-once semantics)

Scope C (real external integrations: Companies House, EA, sanctions,
Lloyd's bordereau submission) is genuinely a future-quarter project
that should be scoped against specific vendor agreements.
