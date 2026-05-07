import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _reset,
  enqueue,
  getStatus,
  init,
  type OrchestratorHooks,
} from './syncOrchestrator';
import type { AuditEvent } from '@/lib/audit';

const FAKE_EVENT: AuditEvent = {
  id: 'evt-test-1',
  kind: 'submission.received',
  at: '2027-05-09T08:00:00Z',
  actor: { kind: 'broker', id: 'Sarah' },
  emailId: 'email-1',
  receivedAt: '2027-05-09T08:00:00Z',
} as unknown as AuditEvent;

const SERVER = 'http://test-server';

function makeHooks(overrides: Partial<OrchestratorHooks> = {}): OrchestratorHooks {
  return {
    getSubmissionId: () => 'sub_test_1',
    getAuditLog: () => [FAKE_EVENT],
    applyServerEvents: vi.fn(),
    ...overrides,
  };
}

describe('syncOrchestrator — disabled mode', () => {
  beforeEach(() => {
    _reset();
  });
  afterEach(() => {
    _reset();
    vi.unstubAllGlobals();
  });

  it('init with serverUrlOverride=null leaves status disabled and never fetches', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await init(makeHooks(), { force: true, serverUrlOverride: null });
    expect(getStatus()).toBe('disabled');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('enqueue is a no-op when disabled', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await init(makeHooks(), { force: true, serverUrlOverride: null });
    enqueue(FAKE_EVENT);
    await new Promise((r) => setTimeout(r, 350));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('syncOrchestrator — enabled mode', () => {
  beforeEach(() => {
    _reset();
  });
  afterEach(() => {
    _reset();
    vi.unstubAllGlobals();
  });

  it('init runs health check then replay; status lands at idle', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith('/health')) {
        return new Response(
          JSON.stringify({ status: 'ok', service: 's', version: '1', time: 't' }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ events: [], highWaterMark: 0 }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetchSpy);

    await init(makeHooks(), { force: true, serverUrlOverride: SERVER });
    expect(getStatus()).toBe('idle');
    expect(fetchSpy).toHaveBeenCalledTimes(2); // health + replay
  });

  it('init falls back to offline when health check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    );
    await init(makeHooks(), { force: true, serverUrlOverride: SERVER });
    expect(getStatus()).toBe('offline');
  });

  it('replay applies server-only events to the local store', async () => {
    const serverEvent = { ...FAKE_EVENT, id: 'evt-from-server' } as AuditEvent;
    const applyServerEvents = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/health')) {
          return new Response(
            JSON.stringify({ status: 'ok', service: 's', version: '1', time: 't' }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            events: [{ ...serverEvent, _serverId: 1, _ingestedAt: 'now' }],
            highWaterMark: 1,
          }),
          { status: 200 },
        );
      }),
    );

    await init(
      makeHooks({ getAuditLog: () => [], applyServerEvents }),
      { force: true, serverUrlOverride: SERVER },
    );

    expect(applyServerEvents).toHaveBeenCalledOnce();
    const applied = applyServerEvents.mock.calls[0]![0] as AuditEvent[];
    expect(applied[0]!.id).toBe('evt-from-server');
    expect((applied[0]! as Record<string, unknown>)._serverId).toBeUndefined();
    expect((applied[0]! as Record<string, unknown>)._ingestedAt).toBeUndefined();
  });

  it('replay dedupes events already in the local log', async () => {
    const applyServerEvents = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/health')) {
          return new Response(
            JSON.stringify({ status: 'ok', service: 's', version: '1', time: 't' }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            events: [{ ...FAKE_EVENT, _serverId: 1, _ingestedAt: 'now' }],
            highWaterMark: 1,
          }),
          { status: 200 },
        );
      }),
    );

    await init(
      makeHooks({
        getAuditLog: () => [FAKE_EVENT], // local already has the event
        applyServerEvents,
      }),
      { force: true, serverUrlOverride: SERVER },
    );

    expect(applyServerEvents).not.toHaveBeenCalled();
  });

  it('enqueue debounces and POSTs the queued events', async () => {
    const posted: Array<{ submissionId: string; events: unknown[] }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opts?: RequestInit) => {
        if (url.endsWith('/health')) {
          return new Response(
            JSON.stringify({ status: 'ok', service: 's', version: '1', time: 't' }),
            { status: 200 },
          );
        }
        if (opts?.method === 'POST') {
          posted.push(JSON.parse(String(opts.body)));
          return new Response(
            JSON.stringify({ appended: 1, firstId: 1, lastId: 1 }),
            { status: 201 },
          );
        }
        return new Response(
          JSON.stringify({ events: [], highWaterMark: 0 }),
          { status: 200 },
        );
      }),
    );

    const second = { ...FAKE_EVENT, id: 'evt-test-2' } as AuditEvent;
    await init(
      makeHooks({ getAuditLog: () => [FAKE_EVENT, second] }),
      { force: true, serverUrlOverride: SERVER },
    );
    enqueue(FAKE_EVENT);
    enqueue(second);

    // Wait past the 200ms debounce window.
    await new Promise((r) => setTimeout(r, 350));

    expect(posted.length).toBe(1);
    expect(posted[0]!.submissionId).toBe('sub_test_1');
    expect(posted[0]!.events).toHaveLength(2);
  });
});
