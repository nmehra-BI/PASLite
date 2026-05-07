import { Hono } from 'hono';

/** Liveness + version. The cockpit can ping this on startup to
 *  detect whether a backend is reachable; if not, it falls back
 *  to localStorage-only operation as it does today. */
export function healthRoutes() {
  const app = new Hono();

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'paslite-server',
      version: '0.1.0',
      time: new Date().toISOString(),
    }),
  );

  return app;
}
