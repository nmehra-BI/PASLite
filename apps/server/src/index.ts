/**
 * Network entry point. Opens the SQLite event store on disk and
 * binds the Hono app to a port (default 3001).
 */

import { serve } from '@hono/node-server';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { openDb } from './db.js';

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);
const DB_PATH = process.env.PASLITE_DB ?? resolve(process.cwd(), 'data/paslite.db');

const db = openDb(DB_PATH);
const app = createApp(db);

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(
    `[paslite-server] listening on http://localhost:${info.port} · db=${DB_PATH}`,
  );
});

function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`[paslite-server] received ${signal}, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
