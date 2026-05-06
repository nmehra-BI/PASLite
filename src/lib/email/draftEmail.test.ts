import { describe, expect, it } from 'vitest';
import { draftEmail } from './draftEmail';
import { getGreenlineSubmission } from '@/lib/fixtures';

const baseInputs = {
  submission: getGreenlineSubmission(),
  premium: 38_265,
  brokerName: 'Sarah',
  brokerTarget: 45_000,
  lossRatio: 0.38,
  leedsPermitWarranty: true,
  underwriter: 'Nishit',
  ref: 'POL-29481-Q1',
};

describe('draftEmail', () => {
  it('opens with a fresh-quote sentence by default', () => {
    const { subject, body } = draftEmail(baseInputs);
    expect(subject).not.toContain('(revised)');
    expect(body).toContain('Pleased to attach our quote');
    expect(body).not.toContain('Following our quote of');
  });

  it('opens with revision-acknowledging sentence + (revised) subject when priorVersion is set', () => {
    const { subject, body } = draftEmail({
      ...baseInputs,
      premium: 40_732,
      priorVersion: { premium: 38_265, sentAt: '2026-05-09T09:33:00Z' },
    });
    expect(subject).toContain('(revised)');
    expect(body).toMatch(/Following our quote of \d+ \w+ \(£38,265\)/);
    expect(body).toContain('£40,732');
    expect(body).toContain('please disregard the prior version');
  });

  it('mentions the broker target gap when premium is below target', () => {
    const { body } = draftEmail({ ...baseInputs, premium: 38_265 });
    expect(body).toContain('£45,000');
    expect(body).toMatch(/below your stated target/);
  });

  it('flags Leeds permit warranty when applicable', () => {
    const { body } = draftEmail(baseInputs);
    expect(body).toContain('Leeds permit expiring 1 July');
  });
});
