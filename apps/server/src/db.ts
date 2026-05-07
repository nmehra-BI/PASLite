/**
 * SQLite event store.
 *
 * Single events table; schema kept minimal so a future migration to
 * Postgres + a typed schema is straightforward. Events are append-
 * only by design — the audit log's whole point is immutability.
 *
 * WAL mode + a single integer auto-increment id give us:
 *   - concurrent readers (cockpit replays don't block writers)
 *   - monotonic ids for pagination via ?since=N
 *   - durable writes without long fsyncs in the hot path
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IncomingEvent, StoredEvent } from './types.js';

export type DbHandle = {
  insertEvents: (
    submissionId: string,
    events: IncomingEvent[],
  ) => { firstId: number | null; lastId: number | null; appended: number };
  readEventsSince: (submissionId: string, sinceId: number) => StoredEvent[];
  countEvents: (submissionId: string) => number;
  close: () => void;
};

export function openDb(path: string): DbHandle {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_event_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      at TEXT NOT NULL,
      ingested_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_submission_id
      ON events(submission_id, id);
    CREATE INDEX IF NOT EXISTS idx_events_kind
      ON events(submission_id, kind);
  `);

  const insertOne = db.prepare<
    [string, string, string, string, string, string],
    { id: number }
  >(`
    INSERT INTO events (client_event_id, submission_id, kind, at, ingested_at, payload)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING id
  `);

  const selectSince = db.prepare<[string, number], StoredEvent>(`
    SELECT id, client_event_id AS clientEventId, submission_id AS submissionId,
           kind, at, ingested_at AS ingestedAt, payload
    FROM events
    WHERE submission_id = ? AND id > ?
    ORDER BY id ASC
  `);

  const countStmt = db.prepare<[string], { n: number }>(
    'SELECT COUNT(*) AS n FROM events WHERE submission_id = ?',
  );

  function insertEvents(
    submissionId: string,
    events: IncomingEvent[],
  ): { firstId: number | null; lastId: number | null; appended: number } {
    if (events.length === 0) return { firstId: null, lastId: null, appended: 0 };

    const ingestedAt = new Date().toISOString();
    let firstId: number | null = null;
    let lastId: number | null = null;
    let appended = 0;

    const tx = db.transaction((batch: IncomingEvent[]) => {
      for (const e of batch) {
        const row = insertOne.get(
          String(e.id ?? ''),
          submissionId,
          String(e.kind ?? 'unknown'),
          String(e.at ?? ingestedAt),
          ingestedAt,
          JSON.stringify(e),
        );
        if (!row) continue;
        if (firstId === null) firstId = row.id;
        lastId = row.id;
        appended++;
      }
    });
    tx(events);

    return { firstId, lastId, appended };
  }

  function readEventsSince(submissionId: string, sinceId: number): StoredEvent[] {
    return selectSince.all(submissionId, sinceId);
  }

  function countEvents(submissionId: string): number {
    return countStmt.get(submissionId)?.n ?? 0;
  }

  function close() {
    db.close();
  }

  return { insertEvents, readEventsSince, countEvents, close };
}
