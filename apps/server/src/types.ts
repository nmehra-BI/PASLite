/**
 * Server-side audit event envelope.
 *
 * The cockpit's `AuditEvent` (src/lib/audit/types.ts in the frontend)
 * is a fully-typed discriminated union of ~120 event kinds. This
 * server treats events opaquely — every event is JSON with a few
 * known top-level fields. We don't re-derive the union here because:
 *
 *   1. The schema is deeply tenant-specific (W&R-shaped today).
 *   2. The server's job is to persist + serve, not to validate
 *      domain semantics. Validation belongs at the cockpit boundary
 *      where the typed reducer lives.
 *
 * If the cockpit ever sends a malformed event, replay on the
 * frontend will surface it; we'd rather store the bad event than
 * drop it. (A future hardening pass could add Zod validation.)
 */

export type StoredEvent = {
  /** Server-assigned monotonic id. Returned to clients so they can
   *  paginate via ?since=N. */
  id: number;
  /** Caller-supplied id from the cockpit's audit log (stable across
   *  client restarts; not unique on the server because the same
   *  event can be re-seeded by replays in development). */
  clientEventId: string;
  /** The submission this event belongs to. The server scopes events
   *  to a submission so two cockpits can collaborate on different
   *  submissions without seeing each other's traffic. */
  submissionId: string;
  /** Audit-event kind (e.g. 'bind.committed'). Indexed for filtering. */
  kind: string;
  /** ISO-8601 timestamp the event fired. */
  at: string;
  /** Server-side ingestion timestamp (for diagnostics / replication). */
  ingestedAt: string;
  /** Full event payload as JSON-encoded string. */
  payload: string;
};

/** Wire shape of an event as the cockpit posts it. The server is
 *  permissive: any object with `id`, `kind`, `at` is accepted. */
export type IncomingEvent = {
  id: string;
  kind: string;
  at: string;
  /** All other fields ride through the payload. */
  [key: string]: unknown;
};

export type AppendRequest = {
  submissionId: string;
  events: IncomingEvent[];
};

export type AppendResponse = {
  appended: number;
  firstId: number | null;
  lastId: number | null;
};

export type ReplayResponse = {
  events: Array<IncomingEvent & { _serverId: number; _ingestedAt: string }>;
  highWaterMark: number;
};
