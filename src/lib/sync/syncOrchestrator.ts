/**
 * Sync orchestrator — single-instance state machine that manages
 * the cockpit's outbound queue + inbound replay against the
 * paslite-server.
 *
 * Design principles:
 *   - LOCAL-FIRST. The cockpit never blocks on the network. Events
 *     land in the local store immediately (existing behaviour) and
 *     are queued for the server in a separate path.
 *   - OPTIONAL. When VITE_SERVER_URL is unset the orchestrator is a
 *     no-op; the cockpit works exactly as before. Tests don't need
 *     to know about it.
 *   - APPEND-ONLY semantics. Server is authoritative for ordering
 *     (it assigns monotonic ids), but local IDs are stable across
 *     replays so dedup is trivial: keep the first event seen for
 *     each `event.id`.
 *   - SUBSCRIBABLE STATUS. UI components read status via subscribe()
 *     to render a connection indicator without re-renders elsewhere.
 *
 * Out of scope today: WebSocket push, conflict resolution beyond
 * dedup, optimistic locking, idempotency keys with retries that
 * survive process restart.
 */

import type { AuditEvent } from '@/lib/audit';
import {
  checkHealth,
  getServerUrl,
  postEvents,
  replayEvents,
  SyncError,
} from './syncClient';
import type { SyncStatus } from './types';

const DEBOUNCE_MS = 200;
const MAX_BATCH = 500;
const RETRY_DELAYS_MS = [0, 1_000, 4_000, 15_000]; // exponential-ish

export type OrchestratorHooks = {
  /** Returns the active submission id, or null when no submission
   *  is loaded. The orchestrator uses this to scope writes + reads. */
  getSubmissionId: () => string | null;
  /** Returns the cockpit's current audit log so the orchestrator
   *  can compute "what's not yet on the server" + dedup replays. */
  getAuditLog: () => AuditEvent[];
  /** Append events fetched from the server into the cockpit's
   *  audit log. The store handles dedup by event.id. */
  applyServerEvents: (events: AuditEvent[]) => void;
};

type OrchestratorState = {
  status: SyncStatus;
  serverUrl: string | null;
  pendingByRef: Map<string, Set<string>>; // submissionId → set of event.id
  flushTimer: ReturnType<typeof setTimeout> | null;
  retryDelayIndex: number;
  /** High-water-mark per submissionId for incremental replay. */
  watermark: Map<string, number>;
  hooks: OrchestratorHooks | null;
  subscribers: Set<(status: SyncStatus) => void>;
};

const state: OrchestratorState = {
  status: 'disabled',
  serverUrl: null,
  pendingByRef: new Map(),
  flushTimer: null,
  retryDelayIndex: 0,
  watermark: new Map(),
  hooks: null,
  subscribers: new Set(),
};

function setStatus(next: SyncStatus) {
  if (state.status === next) return;
  state.status = next;
  for (const fn of state.subscribers) fn(next);
}

export function getStatus(): SyncStatus {
  return state.status;
}

export function subscribe(fn: (status: SyncStatus) => void): () => void {
  state.subscribers.add(fn);
  fn(state.status);
  return () => {
    state.subscribers.delete(fn);
  };
}

/** Initialise the orchestrator. Idempotent — calling twice with
 *  the same URL is a no-op. Pass force=true in tests to reset.
 *
 *  `serverUrl` defaults to getServerUrl() (Vite env). Tests pass
 *  an explicit value because import.meta.env can't be stubbed
 *  cleanly at runtime; pass null to force-disable. */
export async function init(
  hooks: OrchestratorHooks,
  opts?: { force?: boolean; serverUrlOverride?: string | null | undefined },
): Promise<void> {
  // Use an explicit "override" key with a sentinel so we can
  // distinguish "caller passed null" from "caller didn't pass".
  const url =
    opts && 'serverUrlOverride' in opts
      ? (opts.serverUrlOverride ?? null)
      : getServerUrl();
  if (!opts?.force && state.serverUrl === url && state.hooks) {
    return;
  }
  state.hooks = hooks;
  state.serverUrl = url;
  state.pendingByRef.clear();
  state.watermark.clear();
  state.retryDelayIndex = 0;

  if (!url) {
    setStatus('disabled');
    return;
  }

  setStatus('connecting');
  try {
    await checkHealth(url);
  } catch {
    setStatus('offline');
    scheduleRetryReplay();
    return;
  }
  await replayActive();
}

/** Queue an event for the server. No-op when sync is disabled.
 *  Events are batched and flushed after DEBOUNCE_MS to amortise
 *  the request cost across the many events a single user action
 *  produces (extraction alone fires 12+ events). */
export function enqueue(event: AuditEvent): void {
  if (!state.serverUrl || !state.hooks) return;
  const submissionId = state.hooks.getSubmissionId();
  if (!submissionId) return; // pre-submission events have nowhere to go

  let set = state.pendingByRef.get(submissionId);
  if (!set) {
    set = new Set();
    state.pendingByRef.set(submissionId, set);
  }
  set.add(event.id);
  scheduleFlush();
}

function scheduleFlush() {
  if (state.flushTimer) return;
  state.flushTimer = setTimeout(() => {
    state.flushTimer = null;
    void flushNow();
  }, DEBOUNCE_MS);
}

async function flushNow(): Promise<void> {
  if (!state.serverUrl || !state.hooks) return;
  if (state.pendingByRef.size === 0) return;

  setStatus('syncing');
  const log = state.hooks.getAuditLog();
  const byId = new Map(log.map((e) => [e.id, e]));

  for (const [submissionId, idSet] of state.pendingByRef.entries()) {
    if (idSet.size === 0) continue;
    const events: AuditEvent[] = [];
    for (const id of idSet) {
      const e = byId.get(id);
      if (e) events.push(e);
    }
    if (events.length === 0) {
      idSet.clear();
      continue;
    }
    // Send in chunks to stay within the server's per-request limit.
    for (let i = 0; i < events.length; i += MAX_BATCH) {
      const batch = events.slice(i, i + MAX_BATCH);
      try {
        await postEvents(state.serverUrl, submissionId, batch);
      } catch (e) {
        if (e instanceof SyncError) {
          setStatus('offline');
          scheduleRetryFlush();
          return;
        }
        setStatus('error');
        return;
      }
    }
    // Successfully flushed this submission. Clear pending; advance
    // watermark conservatively (replay will reconcile).
    idSet.clear();
  }
  state.retryDelayIndex = 0;
  setStatus('idle');
}

function scheduleRetryFlush() {
  const delay = RETRY_DELAYS_MS[
    Math.min(state.retryDelayIndex, RETRY_DELAYS_MS.length - 1)
  ]!;
  state.retryDelayIndex++;
  setTimeout(() => {
    void flushNow();
  }, delay);
}

function scheduleRetryReplay() {
  const delay = RETRY_DELAYS_MS[
    Math.min(state.retryDelayIndex, RETRY_DELAYS_MS.length - 1)
  ]!;
  state.retryDelayIndex++;
  setTimeout(() => {
    void replayActive();
  }, delay);
}

/** Pull the active submission's events from the server and merge.
 *  The cockpit's reducer is idempotent on event.id so dedup is just
 *  "skip events whose id is already in the local log". */
export async function replayActive(): Promise<void> {
  if (!state.serverUrl || !state.hooks) return;
  const submissionId = state.hooks.getSubmissionId();
  if (!submissionId) {
    setStatus(state.serverUrl ? 'idle' : 'disabled');
    return;
  }

  setStatus('syncing');
  const since = state.watermark.get(submissionId) ?? 0;
  let response;
  try {
    response = await replayEvents(state.serverUrl, submissionId, since);
  } catch {
    setStatus('offline');
    scheduleRetryReplay();
    return;
  }

  const log = state.hooks.getAuditLog();
  const seen = new Set(log.map((e) => e.id));
  const newEvents = response.events.filter((e) => !seen.has(e.id));
  if (newEvents.length > 0) {
    // Strip server-only metadata before applying — the cockpit's
    // reducer doesn't know about _serverId / _ingestedAt.
    state.hooks.applyServerEvents(
      newEvents.map(({ _serverId, _ingestedAt, ...rest }) => {
        void _serverId;
        void _ingestedAt;
        return rest as AuditEvent;
      }),
    );
  }
  state.watermark.set(submissionId, response.highWaterMark);
  state.retryDelayIndex = 0;
  setStatus('idle');
}

/** Test-only — wipe the singleton between cases. */
export function _reset(): void {
  if (state.flushTimer) clearTimeout(state.flushTimer);
  state.status = 'disabled';
  state.serverUrl = null;
  state.pendingByRef.clear();
  state.watermark.clear();
  state.flushTimer = null;
  state.retryDelayIndex = 0;
  state.hooks = null;
  state.subscribers.clear();
}
