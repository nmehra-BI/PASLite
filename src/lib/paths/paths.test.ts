import { describe, expect, it } from 'vitest';
import { getAtPath, pathMatches, setAtPath } from './paths';

describe('getAtPath', () => {
  const tree = {
    insured: { turnover: { brokerStated: 8_400_000 } },
    sites: [
      { storageTonnage: { brokerStated: 250 } },
      { storageTonnage: { brokerStated: 180 } },
    ],
  };

  it('reads nested keys', () => {
    expect(getAtPath(tree, 'insured.turnover.brokerStated')).toBe(8_400_000);
  });

  it('reads array indices', () => {
    expect(getAtPath(tree, 'sites[0].storageTonnage.brokerStated')).toBe(250);
    expect(getAtPath(tree, 'sites[1].storageTonnage.brokerStated')).toBe(180);
  });

  it('returns undefined for missing branches', () => {
    expect(getAtPath(tree, 'insured.unknown.x')).toBeUndefined();
    expect(getAtPath(tree, 'sites[5].storageTonnage')).toBeUndefined();
  });
});

describe('setAtPath', () => {
  it('mutates a nested key', () => {
    const tree: { insured: { turnover: number } } = { insured: { turnover: 1 } };
    setAtPath(tree, 'insured.turnover', 2);
    expect(tree.insured.turnover).toBe(2);
  });

  it('mutates an array element', () => {
    const tree = { sites: [{ tonnage: 100 }, { tonnage: 200 }] };
    setAtPath(tree, 'sites[1].tonnage', 999);
    expect(tree.sites[1]!.tonnage).toBe(999);
  });

  it('throws when an intermediate segment is missing', () => {
    expect(() => setAtPath({}, 'a.b.c', 1)).toThrow();
  });
});

describe('pathMatches', () => {
  it('matches identical concrete paths', () => {
    expect(pathMatches('insured.turnover', 'insured.turnover')).toBe(true);
  });

  it('returns false for divergent keys', () => {
    expect(pathMatches('insured.turnover', 'cover.turnover')).toBe(false);
  });

  it('matches wildcard against any index', () => {
    expect(pathMatches('sites[*].storageTonnage', 'sites[0].storageTonnage')).toBe(true);
    expect(pathMatches('sites[*].storageTonnage', 'sites[7].storageTonnage')).toBe(true);
  });

  it('does not match when wildcard segment-count differs', () => {
    expect(pathMatches('sites[*].storageTonnage', 'sites[0].storageTonnage.brokerStated')).toBe(false);
  });

  it('matches explicit indices exactly', () => {
    expect(pathMatches('sites[0].storageTonnage', 'sites[0].storageTonnage')).toBe(true);
    expect(pathMatches('sites[0].storageTonnage', 'sites[1].storageTonnage')).toBe(false);
  });
});
