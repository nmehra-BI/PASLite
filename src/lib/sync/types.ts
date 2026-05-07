/**
 * Wire types for the cockpit ↔ paslite-server channel. These mirror
 * apps/server/src/types.ts; we keep the duplication small and
 * deliberate — sharing types would require monorepo workspaces and
 * the server treats events opaquely anyway.
 */

import type { AuditEvent } from '@/lib/audit';

export type SyncStatus =
  | 'disabled'        // No server URL configured; local-only mode
  | 'idle'            // Server configured, nothing pending, last sync OK
  | 'connecting'      // Initial health check in flight
  | 'syncing'         // Replay or push in flight
  | 'offline'         // Recent attempt failed; retrying with backoff
  | 'error';          // Fatal config / protocol error; manual recovery

export type AppendResponse = {
  appended: number;
  firstId: number | null;
  lastId: number | null;
};

export type ReplayResponse = {
  events: Array<AuditEvent & { _serverId: number; _ingestedAt: string }>;
  highWaterMark: number;
};

export type HealthResponse = {
  status: 'ok';
  service: string;
  version: string;
  time: string;
};
