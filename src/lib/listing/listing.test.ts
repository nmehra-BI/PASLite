import { describe, expect, it } from 'vitest';
import {
  buildMorningBriefing,
  computePriority,
  filterByTab,
  groupBySection,
  searchEntries,
} from './index';
import { getListingDemo } from '@/lib/fixtures/listingDemo';

describe('groupBySection', () => {
  it('groups in priority order: needs-attention → awaiting-broker → in-force → recently-closed', () => {
    const groups = groupBySection(getListingDemo());
    expect(groups.map((g) => g.key)).toEqual([
      'needs-attention',
      'awaiting-broker',
      'in-force',
      'recently-closed',
    ]);
  });

  it('every fixture entry lands in exactly one section', () => {
    const entries = getListingDemo();
    const groups = groupBySection(entries);
    const total = groups.reduce((a, g) => a + g.count, 0);
    expect(total).toBe(entries.length);
  });

  it('within a section, HIGH priority sorts ahead of MEDIUM/WATCH/STEADY', () => {
    const entries = getListingDemo();
    const groups = groupBySection(entries);
    const attention = groups.find((g) => g.key === 'needs-attention')!;
    const ranks = { high: 0, medium: 1, watch: 2, steady: 3 };
    for (let i = 1; i < attention.entries.length; i++) {
      expect(
        ranks[attention.entries[i - 1]!.priority] <=
          ranks[attention.entries[i]!.priority],
      ).toBe(true);
    }
  });

  it('Greenline POL-29481 sits in BOUND · IN FORCE', () => {
    const groups = groupBySection(getListingDemo());
    const inForce = groups.find((g) => g.key === 'in-force')!;
    expect(inForce.entries.some((e) => e.ref === 'POL-29481')).toBe(true);
  });
});

describe('searchEntries', () => {
  it('matches by ref number, insured name, or broker (case-insensitive)', () => {
    const all = getListingDemo();
    expect(searchEntries(all, 'GREENLINE').length).toBeGreaterThanOrEqual(1);
    expect(searchEntries(all, 'whitfield').length).toBeGreaterThanOrEqual(2);
    expect(searchEntries(all, 'sub-29503').length).toBe(1);
  });

  it('empty query is a pass-through', () => {
    const all = getListingDemo();
    expect(searchEntries(all, '').length).toBe(all.length);
    expect(searchEntries(all, '   ').length).toBe(all.length);
  });
});

describe('filterByTab', () => {
  it('"in-flight" returns needs-attention + awaiting-broker only', () => {
    const all = getListingDemo();
    const out = filterByTab(all, 'in-flight');
    expect(out.every((e) => e.section === 'needs-attention' || e.section === 'awaiting-broker')).toBe(true);
  });

  it('"bound" returns in-force only', () => {
    const out = filterByTab(getListingDemo(), 'bound');
    expect(out.every((e) => e.section === 'in-force')).toBe(true);
  });

  it('"closed" returns recently-closed only', () => {
    const out = filterByTab(getListingDemo(), 'closed');
    expect(out.every((e) => e.section === 'recently-closed')).toBe(true);
  });
});

describe('computePriority', () => {
  it('Mooredale (high-confidence bind ready) → high', () => {
    const e = getListingDemo().find((x) => x.ref === 'SUB-29503')!;
    expect(computePriority(e)).toBe('high');
  });

  it('Greaves (subjectivity overdue, 7 days) → high', () => {
    const e = getListingDemo().find((x) => x.ref === 'POL-28771')!;
    expect(computePriority(e)).toBe('high');
  });

  it('Brackmoor (renewal trigger 30 days out) → medium', () => {
    const e = getListingDemo().find((x) => x.ref === 'POL-28509')!;
    expect(computePriority(e)).toBe('medium');
  });
});

describe('buildMorningBriefing', () => {
  it('produces a greeting + count + breakdown + non-empty marginalia', () => {
    const b = buildMorningBriefing({
      underwriterName: 'Nishit',
      entries: getListingDemo(),
      now: new Date('2027-05-09T09:00:00+01:00'),
    });
    expect(b.greeting).toMatch(/Good (morning|afternoon|evening), Nishit/);
    expect(b.countLabel).toMatch(/Tuesday|Sunday|Monday|Wednesday|Thursday|Friday|Saturday/);
    expect(b.breakdown).toMatch(/awaiting your review/);
    expect(b.marginalia.length).toBeGreaterThan(40);
  });

  it('cites RegentMGA when the queue mentions it ≥2 times', () => {
    const b = buildMorningBriefing({
      underwriterName: 'Nishit',
      entries: getListingDemo(),
      now: new Date('2027-05-09T09:00:00+01:00'),
    });
    expect(b.marginalia).toMatch(/RegentMGA/);
  });
});
