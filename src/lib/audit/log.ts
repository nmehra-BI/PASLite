import type { AuditEvent } from './types';

let counter = 0;
export function nextEventId(): string {
  counter += 1;
  return `evt_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/**
 * Append a single event to a log, returning a new array. The log is
 * append-only — events are never mutated or removed.
 */
export function addEvent(log: AuditEvent[], event: AuditEvent): AuditEvent[] {
  return [...log, event];
}

export function getEventsBySubmission(
  log: AuditEvent[],
  submissionId: string,
): AuditEvent[] {
  return log.filter((e) => 'submissionId' in e && e.submissionId === submissionId);
}
