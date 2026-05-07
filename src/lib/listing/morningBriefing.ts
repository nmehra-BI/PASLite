/**
 * Generate the hero strip's morning briefing — the cockpit acting as
 * a senior colleague briefing the underwriter at the start of the day.
 *
 * For MVP we rotate among hand-crafted briefings keyed off observable
 * patterns in the listing (broker concentration, competitor pressure,
 * critical-date density). In production this would be LLM-generated
 * over the day's actual queue state.
 *
 * Module 15: autonomy-aware variants. When the ledger has activity
 * (especially at-risk patterns), the briefing surfaces it.
 */

import { getLedgerHistory } from '@/lib/fixtures';
import { applyAtRiskDetection } from '@/lib/ledger';
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
  const { entries, now, needsAttention, awaitingBroker, inForce } = input;

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

  // (5) Module 15: autonomy-aware variant. When no higher-signal
  // queue pattern fires, surface ledger activity (~half the time)
  // so the underwriter sees the AI's track record alongside the
  // morning briefing.
  const autonomyVariant = pickAutonomyMarginalia(now);
  if (autonomyVariant && now.getMinutes() % 2 === 0) {
    return autonomyVariant;
  }

  // (6) Default — quiet day.
  return `Light queue today. ${awaitingBroker.length} quotes out with brokers; ${inForce.length} in force. Good morning to clear chases and prep year-2 strategy on policies in their final 30 days.`;
}

/** Module 15 — autonomy-aware briefing variants. Read the same fixture
 *  the ledger reads, derive activity stats over the last 24 hours,
 *  and surface them. Returns null when there's no autonomy activity
 *  worth mentioning. */
function pickAutonomyMarginalia(now: Date): string | null {
  const all = applyAtRiskDetection(getLedgerHistory());
  const dayMs = 86_400_000;
  const last24 = all.filter(
    (a) => now.getTime() - new Date(a.firedAt).getTime() <= dayMs,
  );
  if (last24.length === 0) return null;

  const passes = last24.filter((a) => a.classId === 'TRIAGE-AUTO-PASS').length;
  const declines = last24.filter(
    (a) => a.classId === 'TRIAGE-AUTO-DECLINE',
  ).length;
  const binds = last24.filter((a) => a.classId === 'BIND-AUTO-COMMIT').length;
  const atRisk = all.filter((a) => a.atRiskPatterns.length > 0).length;

  const last7 = all.filter(
    (a) => now.getTime() - new Date(a.firedAt).getTime() <= 7 * dayMs,
  );
  const last7Recall = last7.filter((a) => a.recalled).length;
  const last7Rate = last7.length > 0 ? (last7Recall / last7.length) * 100 : 0;

  const variants: string[] = [];

  // Variant A — overnight activity recap, with at-risk callout.
  if (last24.length >= 5 && atRisk > 0) {
    variants.push(
      `The AI handled ${last24.length} submissions overnight — ${passes} routine triage passes, ${declines} declines${
        binds > 0 ? `, and ${binds} auto-bind${binds === 1 ? '' : 's'}` : ''
      }. ${atRisk === 1 ? 'One' : `${atRisk}`} flagged at-risk; worth a look in the ledger.`,
    );
  }

  // Variant B — quiet day, recall-rate trending.
  if (last24.length < 8) {
    variants.push(
      `Quiet day for autonomy — only ${last24.length} action${last24.length === 1 ? '' : 's'} in the last 24 hours. The ledger's recall rate dropped to ${last7Rate.toFixed(1)}% this week. Trending in the right direction.`,
    );
  }

  // Variant C — broker-specific rollup.
  const surestepActions = last24.filter((a) =>
    a.brokerName.startsWith('SureStep'),
  );
  if (surestepActions.length >= 3) {
    const sPass = surestepActions.filter(
      (a) => a.classId === 'TRIAGE-AUTO-PASS',
    ).length;
    const sDecline = surestepActions.filter(
      (a) => a.classId === 'TRIAGE-AUTO-DECLINE',
    ).length;
    if (sDecline > 0) {
      variants.push(
        `Sarah at SureStep had ${sPass} submission${sPass === 1 ? '' : 's'} auto-passed this morning and ${sDecline === 1 ? 'one' : sDecline} auto-declined. Worth a quick check that the decline${sDecline === 1 ? ' was' : 's were'} the right call.`,
      );
    }
  }

  if (variants.length === 0) return null;
  // Rotate by minute so the same variant doesn't lock in.
  return variants[now.getMinutes() % variants.length]!;
}
