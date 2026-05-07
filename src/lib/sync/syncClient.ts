/**
 * Bare fetch wrappers around paslite-server. No retries, no queuing
 * — those live in the orchestrator. This file is purely the network
 * boundary: validate response shapes, surface errors with context.
 *
 * The cockpit reads the server URL from VITE_SERVER_URL at build /
 * dev time; an unset value disables the sync layer entirely.
 */

import type { AuditEvent } from '@/lib/audit';
import type {
  AppendResponse,
  HealthResponse,
  ReplayResponse,
} from './types';

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/** Read the server URL from Vite env. Returns null when sync is
 *  disabled (the default). */
export function getServerUrl(): string | null {
  const raw = (import.meta.env?.VITE_SERVER_URL as string | undefined) ?? null;
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

async function jsonOrThrow<T>(res: Response, endpoint: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: string };
      detail = body.error ? `: ${body.error}` : '';
    } catch {
      // body wasn't JSON; fall through with status only
    }
    throw new SyncError(
      `${endpoint} returned ${res.status}${detail}`,
      endpoint,
      res.status,
    );
  }
  return (await res.json()) as T;
}

/** GET /health — used by the orchestrator on init to confirm the
 *  server is reachable before attempting writes. */
export async function checkHealth(serverUrl: string): Promise<HealthResponse> {
  const endpoint = `${serverUrl}/health`;
  let res: Response;
  try {
    res = await fetch(endpoint, { method: 'GET' });
  } catch (e) {
    throw new SyncError(
      `network error: ${e instanceof Error ? e.message : String(e)}`,
      endpoint,
    );
  }
  return jsonOrThrow<HealthResponse>(res, endpoint);
}

/** POST /events — append a batch. Returns the server-assigned id
 *  range so the orchestrator can advance its watermark. */
export async function postEvents(
  serverUrl: string,
  submissionId: string,
  events: AuditEvent[],
): Promise<AppendResponse> {
  const endpoint = `${serverUrl}/events`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ submissionId, events }),
    });
  } catch (e) {
    throw new SyncError(
      `network error: ${e instanceof Error ? e.message : String(e)}`,
      endpoint,
    );
  }
  return jsonOrThrow<AppendResponse>(res, endpoint);
}

/** GET /events?submissionId=X&since=N — pull events with id > N.
 *  The server returns events in ascending id order; the orchestrator
 *  passes back highWaterMark on the next call. */
export async function replayEvents(
  serverUrl: string,
  submissionId: string,
  since: number = 0,
): Promise<ReplayResponse> {
  const params = new URLSearchParams({
    submissionId,
    since: String(since),
  });
  const endpoint = `${serverUrl}/events?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(endpoint, { method: 'GET' });
  } catch (e) {
    throw new SyncError(
      `network error: ${e instanceof Error ? e.message : String(e)}`,
      endpoint,
    );
  }
  return jsonOrThrow<ReplayResponse>(res, endpoint);
}
