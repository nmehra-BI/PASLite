import type { Submission } from '@/lib/fixtures';
import { effectiveValue } from '@/lib/field';
import { formatGBP } from '@/lib/rating';

export type DraftEmailInputs = {
  submission: Submission;
  premium: number;
  brokerName: string;
  brokerTarget: number | null;
  lossRatio: number | null;
  /** Whether the Leeds permit warranty applies (expiring within term). */
  leedsPermitWarranty: boolean;
  /** Underwriter signing the email. */
  underwriter: string;
  /** Quote reference, e.g. POL-29481-Q1 */
  ref: string;
  /**
   * Set when this email is a revised-quote redraft. The body opens
   * with a one-liner acknowledging the prior version.
   */
  priorVersion?: { premium: number; sentAt: string } | null;
};

/**
 * Deterministic broker-facing covering email. Module 5 generates this
 * from a template; module 6 may swap in a real LLM. The body weaves
 * submission state into broker-readable language: broker target gap,
 * loss-ratio context, warranties to flag.
 */
export function draftEmail(inputs: DraftEmailInputs): {
  subject: string;
  body: string;
} {
  const insuredName =
    (effectiveValue(inputs.submission.insured.legalName) as string | null) ??
    'the insured';
  const inceptionRaw =
    (effectiveValue(inputs.submission.cover.inceptionDate) as string | null) ??
    null;
  const inception = inceptionRaw
    ? new Date(inceptionRaw).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
      })
    : 'the requested inception';

  const subject = `Quote for ${insuredName} — ${inputs.ref}`;

  const targetLine = (() => {
    if (inputs.brokerTarget === null) return null;
    const delta = inputs.premium - inputs.brokerTarget;
    if (Math.abs(delta) <= inputs.brokerTarget * 0.02) {
      return `Premium ${formatGBP(inputs.premium)} on Tier-2 — broadly in line with your target of ${formatGBP(inputs.brokerTarget)}.`;
    }
    if (delta < 0) {
      const reason = inputs.lossRatio !== null && inputs.lossRatio < 0.5
        ? `which reflects the profile's strong loss history (${(inputs.lossRatio * 100).toFixed(0)}% LR over five years)`
        : 'reflecting the technical price';
      return `Premium ${formatGBP(inputs.premium)} on Tier-2 — slightly below your stated target of ${formatGBP(inputs.brokerTarget)}, ${reason}.`;
    }
    return `Premium ${formatGBP(inputs.premium)} on Tier-2 — somewhat above your stated target of ${formatGBP(inputs.brokerTarget)}; happy to walk through the build-up if useful.`;
  })();

  const warrantyLines = [
    inputs.leedsPermitWarranty
      ? '    i.  EA permit currency, with particular attention to the Leeds permit expiring 1 July.'
      : '    i.  EA permit currency at all insured locations.',
    '   ii.  Fire suppression maintenance.',
  ];

  const greeting = `Hi ${inputs.brokerName.split(' ')[0] ?? 'there'},`;

  const isRevision = inputs.priorVersion != null;
  const priorDate = isRevision
    ? new Date(inputs.priorVersion!.sentAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
      })
    : null;
  const priorPremium = isRevision
    ? `£${inputs.priorVersion!.premium.toLocaleString('en-GB')}`
    : null;
  const newPremium = `£${inputs.premium.toLocaleString('en-GB')}`;

  const opening = isRevision
    ? `Following our quote of ${priorDate} (${priorPremium}), we've revised the figures to ${newPremium}; please disregard the prior version. The change reflects an updated input on the slip.`
    : `Pleased to attach our quote for ${insuredName}, inception ${inception}.${targetLine ? ' ' + targetLine : ''}`;

  const body = [
    greeting,
    '',
    opening,
    '',
    'Two warranties to flag, both standard for the class:',
    '',
    ...warrantyLines,
    '',
    "Quote valid for 21 days. Happy to discuss; let me know if you'd like to walk through the rating build-up or adjust the warranties.",
    '',
    'Best,',
    inputs.underwriter,
  ].join('\n');

  const finalSubject = isRevision ? `${subject} (revised)` : subject;
  return { subject: finalSubject, body };
}
