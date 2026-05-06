/**
 * Build the post-bind schedule artefact: covering email body, recipient,
 * policy reference. Reuses the slip's warranty text so the schedule
 * reads as the formal version of what the broker was quoted.
 */

import { effectiveValue } from '@/lib/field';
import type { Submission } from '@/lib/fixtures';

const SHORT_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export type ScheduleArtefact = {
  policyRef: string;
  recipient: string;
  recipientName: string;
  coveringNote: string;
};

export function generateSchedule(input: {
  submission: Submission;
  policyRef: string;
  premium: number;
}): ScheduleArtefact {
  const { submission, policyRef } = input;
  const insured = (effectiveValue(submission.insured.legalName) as string | null) ?? 'the insured';
  const inception = (effectiveValue(submission.cover.inceptionDate) as string | null) ?? '';
  const inceptionLabel = inception
    ? SHORT_DATE_FMT.format(new Date(inception))
    : 'inception';
  const inceptionTime = inception
    ? new Date(inception).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'noon';

  // Surface the Leeds permit warranty if it expires in term.
  const sites = submission.sites ?? [];
  const expiryRaw = (effectiveValue(submission.cover.expiryDate) as string | null) ?? '';
  const leeds = sites.find((s) => {
    const n = effectiveValue(s.name) as string | null;
    if (!n?.toLowerCase().includes('leeds')) return false;
    const exp = effectiveValue(s.permitExpiry) as string | null;
    return (
      exp !== null && inception !== '' && expiryRaw !== '' && exp >= inception && exp <= expiryRaw
    );
  });
  const leedsLine = leeds
    ? `Particular note that the EA permit at Leeds (${effectiveValue(leeds.permitRef) as string}) expires ${SHORT_DATE_FMT.format(new Date(effectiveValue(leeds.permitExpiry) as string))}; we'll need renewal evidence within 14 days to keep that site in cover.`
    : '';

  // The broker first name — reuses the heuristic from the recommendation
  // headline so the demo reads consistently.
  const brokerRaw = ((effectiveValue(submission.broker) as string | null) ?? '').toLowerCase();
  const brokerFirstName = brokerRaw.includes('surestep') ? 'Sarah' : 'team';
  const recipientName = brokerRaw.includes('surestep')
    ? 'Sarah Whitfield'
    : 'Broker';
  const recipient = brokerRaw.includes('surestep')
    ? 's.whitfield@surestep.co.uk'
    : 'broker@example.com';

  const coveringNote = [
    `Hi ${brokerFirstName},`,
    '',
    `Confirming bind for ${insured} — ${policyRef} incepting ${inceptionLabel} at ${inceptionTime}. Schedule and bind certificate attached. Warranties as agreed in the quote of 9 May.${leedsLine ? ' ' + leedsLine : ''}`,
    '',
    'Thanks for the business,',
    'Nishit',
  ].join('\n');

  return {
    policyRef,
    recipient,
    recipientName,
    coveringNote,
  };
}
