/**
 * Module 12 — fixture for the listing page.
 *
 * 14 entries across the four sections, with Greenline POL-29481
 * anchoring the BOUND IN FORCE section and a fresh Mooredale
 * recommendation-ready submission anchoring NEEDS YOUR ATTENTION.
 *
 * Names are reused from the historicalBinders fixture where possible
 * for narrative consistency (the cockpit's own book is the moat).
 */

import type { ListingEntry } from '@/lib/listing/types';

const NOW = '2027-05-09T08:30:00+01:00';

function minsAgo(mins: number): string {
  return new Date(new Date(NOW).getTime() - mins * 60_000).toISOString();
}
function hoursAgo(hours: number): string {
  return new Date(new Date(NOW).getTime() - hours * 60 * 60_000).toISOString();
}
function daysAgo(days: number): string {
  return new Date(new Date(NOW).getTime() - days * 86_400_000).toISOString();
}

export const LISTING_DEMO: ListingEntry[] = [
  // ─── NEEDS YOUR ATTENTION ───────────────────────────────────────
  {
    ref: 'SUB-29503',
    insuredName: 'Mooredale Recycling Ltd',
    lob: 'UK W&R',
    phase: 'recommendation-ready',
    priority: 'high',
    section: 'needs-attention',
    glyph: 'action',
    status: 'Recommendation: BIND · high confidence · £42,180',
    context:
      'Profile matches 7 prior binders, all profitable. Pricing below RegentMGA range.',
    premium: 42_180,
    lastActivityAt: minsAgo(14),
    brokerName: 'Sarah Whitfield',
    brokerEmail: 's.whitfield@surestep.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'open-bind-ceremony', label: 'Bind →', tone: 'primary', drillsToCanvas: true },
      { id: 'view-bound', label: 'Refer to senior', tone: 'secondary', drillsToCanvas: true },
      { id: 'view-ntu', label: 'NTU · walk away', tone: 'ghost', drillsToCanvas: true },
    ],
  },
  {
    ref: 'SUB-29498',
    insuredName: 'Hartwell Materials',
    lob: 'UK W&R',
    phase: 'enrichment',
    priority: 'medium',
    section: 'needs-attention',
    glyph: 'conflict',
    status: '1 conflict to resolve · turnover £6.2M (broker) ↔ £5.4M (CH)',
    context:
      'Received 12 minutes ago. First-time broker — watch for over-stated turnover.',
    premium: null,
    lastActivityAt: minsAgo(12),
    brokerName: 'D. Holloway',
    brokerEmail: 'd.holloway@premier-brokers.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'review-conflict', label: 'Review & resolve →', tone: 'primary', drillsToCanvas: true },
      { id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true },
    ],
  },
  {
    ref: 'SUB-29495',
    insuredName: 'Brackthorne Industries',
    lob: 'UK W&R',
    phase: 'triage',
    priority: 'medium',
    section: 'needs-attention',
    glyph: 'conflict',
    status: 'Triage REFER · capacity edge case (Synd 2358 at 89%)',
    context: null,
    premium: null,
    lastActivityAt: hoursAgo(1),
    brokerName: 'J. Khan',
    brokerEmail: 'j.khan@cromer-broking.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'review-triage-refer', label: 'Review referral →', tone: 'primary', drillsToCanvas: true },
      { id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true },
    ],
  },

  // ─── (one bound policy with subjectivity overdue belongs in attention) ──
  {
    ref: 'POL-28771',
    insuredName: 'Greaves Waste Services',
    lob: 'UK W&R',
    phase: 'in-force-with-mta',
    priority: 'high',
    section: 'needs-attention',
    glyph: 'watch',
    status: 'EA permit at Manchester expires in 7 days · subjectivity active',
    context: 'Last evidence request 14 days ago — Sarah hasn’t responded.',
    premium: 33_400,
    lastActivityAt: daysAgo(14),
    brokerName: 'Sarah Whitfield',
    brokerEmail: 's.whitfield@surestep.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'chase-broker', label: 'Chase Sarah', tone: 'primary', drillsToCanvas: false },
      { id: 'mark-evidence-received', label: 'Mark received', tone: 'secondary', drillsToCanvas: false },
      { id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true },
    ],
  },

  // ─── AWAITING BROKER ────────────────────────────────────────────
  {
    ref: 'SUB-29487',
    insuredName: 'Brackmoor Recycling Ltd',
    lob: 'UK W&R',
    phase: 'awaiting-broker',
    priority: 'watch',
    section: 'awaiting-broker',
    glyph: 'steady',
    status: 'Quote sent 3 days ago at £35,820. Awaiting Sarah’s response.',
    context: 'Sarah typically responds within 5 days. No action needed yet.',
    premium: 35_820,
    lastActivityAt: daysAgo(3),
    brokerName: 'Sarah Whitfield',
    brokerEmail: 's.whitfield@surestep.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'chase-broker', label: 'Chase broker', tone: 'primary', drillsToCanvas: false },
      { id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true },
    ],
  },
  {
    ref: 'SUB-29442',
    insuredName: 'Northpoint Recovery',
    lob: 'UK W&R',
    phase: 'awaiting-broker',
    priority: 'watch',
    section: 'awaiting-broker',
    glyph: 'steady',
    status: 'Revised quote sent yesterday after re-rate.',
    context: 'Original quote went stale on conflict resolution; revised £41,910.',
    premium: 41_910,
    lastActivityAt: daysAgo(1),
    brokerName: 'Sarah Whitfield',
    brokerEmail: 's.whitfield@surestep.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'chase-broker', label: 'Chase broker', tone: 'primary', drillsToCanvas: false },
      { id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true },
    ],
  },
  {
    ref: 'SUB-29401',
    insuredName: 'Caulfield Recovery',
    lob: 'UK W&R',
    phase: 'awaiting-broker',
    priority: 'medium',
    section: 'awaiting-broker',
    glyph: 'steady',
    status: 'Quote sent 6 days ago at £28,900.',
    context: 'Sarah typically responds within 5 days; consider chase.',
    premium: 28_900,
    lastActivityAt: daysAgo(6),
    brokerName: 'Sarah Whitfield',
    brokerEmail: 's.whitfield@surestep.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'chase-broker', label: 'Chase broker', tone: 'primary', drillsToCanvas: false },
      { id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true },
    ],
  },

  // ─── BOUND · IN FORCE ───────────────────────────────────────────
  {
    ref: 'POL-29481',
    insuredName: 'Greenline Recycling Ltd',
    lob: 'UK W&R',
    phase: 'in-force-with-mta',
    priority: 'watch',
    section: 'in-force',
    glyph: 'watch',
    status: 'Year 2 in force · £52,000 · 7 days until Leeds permit critical date',
    context: 'Renewal succeeded clean year-1 · LR 38%. Permit deadline approaching.',
    premium: 52_000,
    lastActivityAt: daysAgo(2),
    brokerName: 'Sarah Whitfield',
    brokerEmail: 's.whitfield@surestep.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'mark-evidence-received', label: 'Mark received', tone: 'secondary', drillsToCanvas: false },
      { id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true },
    ],
  },
  {
    ref: 'POL-29104',
    insuredName: 'Northpoint Recycling Ltd',
    lob: 'UK W&R',
    phase: 'bound',
    priority: 'steady',
    section: 'in-force',
    glyph: 'closed',
    status: '8 months in force · LR 31% · healthy',
    context: null,
    premium: 41_200,
    lastActivityAt: daysAgo(60),
    brokerName: 'D. Holloway',
    brokerEmail: 'd.holloway@premier-brokers.co.uk',
    lastChaseAt: null,
    actions: [{ id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true }],
  },
  {
    ref: 'POL-28509',
    insuredName: 'Brackmoor Recycling Ltd',
    lob: 'UK W&R',
    phase: 'bound',
    priority: 'watch',
    section: 'in-force',
    glyph: 'watch',
    status: '11 months in force · LR 38% · renewal trigger in 30 days',
    context: 'Year-1 has run clean. Begin year-2 strategy preparation.',
    premium: 47_800,
    lastActivityAt: daysAgo(5),
    brokerName: 'Sarah Whitfield',
    brokerEmail: 's.whitfield@surestep.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'open-renewal-trigger', label: 'Begin renewal →', tone: 'primary', drillsToCanvas: true },
      { id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true },
    ],
  },
  {
    ref: 'POL-28361',
    insuredName: 'Ardent Materials Ltd',
    lob: 'UK W&R',
    phase: 'bound',
    priority: 'medium',
    section: 'in-force',
    glyph: 'watch',
    status: '6 months in force · 1 open claim (£12,400 reserve)',
    context: 'Run-off pattern emerging; monitor claims development weekly.',
    premium: 38_700,
    lastActivityAt: daysAgo(7),
    brokerName: 'J. Khan',
    brokerEmail: 'j.khan@cromer-broking.co.uk',
    lastChaseAt: null,
    actions: [
      { id: 'review-claim', label: 'Review claim →', tone: 'primary', drillsToCanvas: true },
      { id: 'open-canvas', label: 'Open', tone: 'ghost', drillsToCanvas: true },
    ],
  },

  // ─── RECENTLY CLOSED ────────────────────────────────────────────
  {
    ref: 'SUB-29388',
    insuredName: 'Pendle Recycling Ltd',
    lob: 'UK W&R',
    phase: 'ntu',
    priority: 'steady',
    section: 'recently-closed',
    glyph: 'declined',
    status: 'NTU 5 days ago · lost to RegentMGA at £35,000',
    context: 'Sharp price competition; logged in competitive intel.',
    premium: 40_200,
    lastActivityAt: daysAgo(5),
    brokerName: 'Sarah Whitfield',
    brokerEmail: 's.whitfield@surestep.co.uk',
    lastChaseAt: null,
    actions: [{ id: 'view-ntu', label: 'View NTU record', tone: 'ghost', drillsToCanvas: true }],
  },
  {
    ref: 'SUB-29345',
    insuredName: 'Marlowe Materials',
    lob: 'UK W&R',
    phase: 'declined',
    priority: 'steady',
    section: 'recently-closed',
    glyph: 'declined',
    status: 'Declined for cause 9 days ago · misrepresentation',
    context: 'Companies House sanctions hit on re-screen.',
    premium: null,
    lastActivityAt: daysAgo(9),
    brokerName: 'J. Khan',
    brokerEmail: 'j.khan@cromer-broking.co.uk',
    lastChaseAt: null,
    actions: [{ id: 'view-declined', label: 'View decline note', tone: 'ghost', drillsToCanvas: true }],
  },
  {
    ref: 'POL-27982',
    insuredName: 'Greaves Waste Services',
    lob: 'UK W&R',
    phase: 'cancelled',
    priority: 'steady',
    section: 'recently-closed',
    glyph: 'declined',
    status: 'Cancelled mid-term 14 days ago · short-rate refund',
    context: 'Insured switched to RegentMGA · logged as competitor switch.',
    premium: 33_400,
    lastActivityAt: daysAgo(14),
    brokerName: 'Sarah Whitfield',
    brokerEmail: 's.whitfield@surestep.co.uk',
    lastChaseAt: null,
    actions: [{ id: 'view-cancellation', label: 'View cancellation', tone: 'ghost', drillsToCanvas: true }],
  },
];

export function getListingDemo(): ListingEntry[] {
  return JSON.parse(JSON.stringify(LISTING_DEMO)) as ListingEntry[];
}
