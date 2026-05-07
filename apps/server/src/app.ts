/**
 * Pure Hono app factory — takes a DbHandle, returns a configured
 * Hono instance. Separated from the network entry (`index.ts`) so
 * tests can spin up an in-process app without binding a port.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { DbHandle } from './db.js';
import { eventsRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';

export function createApp(db: DbHandle, opts?: { silent?: boolean }) {
  const app = new Hono();

  if (!opts?.silent) app.use('*', logger());
  // Permissive CORS for the Vite dev server. Production should
  // restrict origin via env config.
  app.use(
    '*',
    cors({
      origin: (origin) => origin,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      credentials: false,
    }),
  );

  app.route('/', healthRoutes());
  app.route('/', eventsRoutes(db));

  app.onError((err, c) => {
    // Hono's default error handler is fine for a demo; we just
    // ensure the response is JSON, never HTML.
    if (!opts?.silent) {
      // eslint-disable-next-line no-console
      console.error('[paslite-server] unhandled error:', err);
    }
    return c.json({ error: err.message ?? 'internal error' }, 500);
  });

  app.notFound((c) => c.json({ error: 'not found' }, 404));

  return app;
}
