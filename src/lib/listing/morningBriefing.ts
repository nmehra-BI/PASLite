/**
 * Generate the hero strip's morning briefing — the cockpit acting as
 * a senior colleague briefing the underwriter at the start of the day.
 *
 * For MVP we rotate among hand-crafted briefings keyed off observable
 * patterns in the listing (broker concentration, competitor pressure,
 * critical-date density). In production this would be LLM-generated
 * over the day's actual queue state.
 */

import type { ListingEntry, MorningBriefing } from './types';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function buildMorningBriefing(input: {
  underwriterName: string;
  entries: ListingEntry[];
  now?: Date;
}): MorningBriefing {
  const { underwriterName, entries } = input;
  const now = input.now ?? new Date();

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return `Good morning, ${underwriterName}`;
    if (h < 17) return `Good afternoon, ${underwriterName}`;
    return `Good evening, ${underwriterName}`;
  })();

  const needsAttention = entries.filter((e) => e.section === 'needs-attention');
  const awaitingBroker = entries.filter((e) => e.section === 'awaiting-broker');
  const inForce = entries.filter((e) => e.section === 'in-force');

  const countLabel = `${needsAttention.length + awaitingBroker.length} submission${
    needsAttention.length + awaitingBroker.length === 1 ? '' : 's'
  } need your attention · ${DATE_FMT.format(now)}`;

  const reviewCount = needsAttention.filter((e) =>
    e.actions.some((a) => a.tone === 'primary' && a.drillsToCanvas),
  ).length;
  const brokerWaiting = needsAttention.filter((e) =>
    e.actions.some((a) => a.id === 'chase-broker'),
  ).length;
  const quotedOut = awaitingBroker.length;

  const breakdown = `${reviewCount} awaiting your review · ${brokerWaiting} awaiting broker · ${quotedOut} quoted out`;

  // Marginalia: pick the highest-signal pattern in the queue.
  const marginalia = pickMarginalia({
    entries,
    now,
    needsAttention,
    awaitingBroker,
    inForce,
  });

  return { greeting, countLabel, breakdown, marginalia };
}

function pickMarginalia(input: {
  entries: ListingEntry[];
  now: Date;
  needsAttention: ListingEntry[];
  awaitingBroker: ListingEntry[];
  inForce: ListingEntry[];
}): string {
  const { entries, needsAttention, awaitingBroker, inForce } = input;

  // (1) RegentMGA pressure pattern — competitor mentions in status/context.
  const regentTouches = entries.filter(
    (e) => /regent/i.test(e.status) || /regent/i.test(e.context ?? ''),
  );
  if (regentTouches.length >= 2) {
    const sarahCount = entries.filter((e) => e.brokerName.startsWith('Sarah')).length;
    if (sarahCount >= 3) {
      return `RegentMGA's been busy this week — ${regentTouches.length} of your records mention them. Sarah at SureStep is on ${sarahCount}. The cockpit suggests batching her communications today.`;
    }
    return `RegentMGA's been busy this week — ${regentTouches.length} of your records mention competitor pressure. Worth a defence-pricing review on quoted-out submissions.`;
  }

  // (2) Permit / critical-date density.
  const upcomingCriticals = inForce.filter((e) => /\d+\s+days?/i.test(e.status));
  if (upcomingCriticals.length >= 2) {
    return `Quiet day for new business. ${upcomingCriticals.length} bound policies have permit renewals coming up — Leeds (Greenline) is the most urgent. Consider clearing chases ahead of lunch.`;
  }

  // (3) High-confidence bind ready.
  const highConfBind = needsAttention.find((e) =>
    /high confidence/i.test(e.status),
  );
  if (highConfBind) {
    return `Mid-week and the queue is light. ${highConfBind.insuredName} needs your bind decision today — the recommendation is high-confidence and ${highConfBind.brokerName.split(' ')[0]} has been patient. Consider clearing it before lunch.`;
  }

  // (4) New brokers pattern.
  const newBrokers = needsAttention.filter(
    (e) => !e.brokerName.startsWith('Sarah'),
  );
  if (newBrokers.length >= 2) {
    return `${newBrokers.length} submissions this morning from brokers you haven't seen recently. Watch the conflict patterns — first-time brokers tend to over-state turnover by 15-20%.`;
  }

  // (5) Default — quiet day.
  return `Light queue today. ${awaitingBroker.length} quotes out with brokers; ${inForce.length} in force. Good morning to clear chases and prep year-2 strategy on policies in their final 30 days.`;
}
