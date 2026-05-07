import type { LifecycleMilestone } from '@/lib/fixtures';
import type { RanBerriState } from '@/store';

/**
 * Best-effort date projection per milestone for tooltip / status-bar
 * display. Drawn from the audit-log-derived state slices that have
 * commit timestamps; falls back to the submission's receivedAt for
 * pre-bind milestones.
 */
export function milestoneDate(
  milestone: LifecycleMilestone,
  s: RanBerriState,
): string | null {
  const submissionReceived = s.submission?.receivedAt ?? null;
  switch (milestone) {
    case 'quote':
      return submissionReceived;
    case 'quoted':
      return s.quote.sentAt ?? submissionReceived;
    case 'bind':
      return s.bind.committedAt ?? null;
    case 'mta-04': {
      const lastVersion = s.policy.versions[s.policy.versions.length - 1];
      return lastVersion?.signedAt ?? null;
    }
    case 'cancel':
      return s.cancellation.committedAt ?? null;
    case 'renewal':
      return s.renewal.committedAt ?? null;
    default:
      return null;
  }
}

const FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_ONLY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatMilestoneDate(iso: string | null): string {
  if (!iso) return '—';
  return FMT.format(new Date(iso));
}

export function formatMilestoneDateLong(iso: string | null): string {
  if (!iso) return '—';
  return DATE_ONLY.format(new Date(iso));
}

export const MILESTONE_LABEL: Record<LifecycleMilestone, string> = {
  quote: 'Quote',
  quoted: 'Quoted',
  bind: 'Bind',
  'mta-04': 'MTA-04',
  cancel: 'Cancel',
  renewal: 'Renewal',
};

const MILESTONE_ORDER: LifecycleMilestone[] = [
  'quote',
  'quoted',
  'bind',
  'mta-04',
  'cancel',
  'renewal',
];

/**
 * Compare cursor against now to derive the viewing state.
 *   cursor === now      → 'now'
 *   cursor before now   → 'historical'
 *   cursor after now    → 'forecast'
 */
export function viewingState(
  cursor: LifecycleMilestone,
  now: LifecycleMilestone,
): 'now' | 'historical' | 'forecast' {
  if (cursor === now) return 'now';
  const ci = MILESTONE_ORDER.indexOf(cursor);
  const ni = MILESTONE_ORDER.indexOf(now);
  return ci < ni ? 'historical' : 'forecast';
}

export const MILESTONE_ORDER_CONST = MILESTONE_ORDER;
