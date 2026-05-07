import { describe, it, expect } from 'vitest';
import { computeEndorsementId, parseEndorsementId } from './computeEndorsementId';

describe('computeEndorsementId', () => {
  it('produces MTA-04 when 3 endorsements already exist (Greenline demo)', () => {
    expect(computeEndorsementId(3)).toBe('MTA-04');
  });

  it('produces MTA-02 when 1 endorsement already exists', () => {
    expect(computeEndorsementId(1)).toBe('MTA-02');
  });

  it('produces MTA-12 when 11 endorsements already exist', () => {
    expect(computeEndorsementId(11)).toBe('MTA-12');
  });

  it('zero-pads single-digit numbers', () => {
    expect(computeEndorsementId(0)).toBe('MTA-01');
    expect(computeEndorsementId(8)).toBe('MTA-09');
  });

  it('does not zero-pad three-digit numbers', () => {
    expect(computeEndorsementId(99)).toBe('MTA-100');
  });
});

describe('parseEndorsementId', () => {
  it('inverts computeEndorsementId', () => {
    expect(parseEndorsementId('MTA-04')).toBe(4);
    expect(parseEndorsementId('MTA-02')).toBe(2);
    expect(parseEndorsementId('MTA-12')).toBe(12);
  });

  it('returns null for non-canonical input', () => {
    expect(parseEndorsementId('MTA')).toBeNull();
    expect(parseEndorsementId('mta-04')).toBe(4); // case-insensitive
    expect(parseEndorsementId('not-an-mta')).toBeNull();
  });
});
