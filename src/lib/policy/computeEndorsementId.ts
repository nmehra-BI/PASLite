/**
 * Endorsement-id derivation for mid-term adjustments.
 *
 * The display identifier for an endorsement is formatted as MTA-NN
 * where NN is the 2-digit zero-padded ordinal of the endorsement
 * within the policy. The number is derived from policy state, not
 * from fixture authoring — a future tenant whose policy has a
 * different prior-endorsement history gets the right identifier
 * automatically.
 *
 *   computeEndorsementId(3) === 'MTA-04'
 *     (3 endorsements already exist; this is the 4th)
 *
 *   computeEndorsementId(1) === 'MTA-02'
 *     (1 endorsement already exists; this is the 2nd)
 *
 *   computeEndorsementId(11) === 'MTA-12'
 *     (11 endorsements already exist; this is the 12th)
 */

export function computeEndorsementId(existingEndorsementCount: number): string {
  const ordinal = existingEndorsementCount + 1;
  return `MTA-${String(ordinal).padStart(2, '0')}`;
}

/** Parse an MTA endorsement-id string back to its numeric ordinal.
 *  Returns null when the input doesn't match the canonical format. */
export function parseEndorsementId(id: string): number | null {
  const m = id.match(/^MTA-(\d+)$/i);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return Number.isNaN(n) ? null : n;
}
