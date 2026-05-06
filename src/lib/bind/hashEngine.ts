/**
 * Mock content-addressable hashing.
 *
 * Real production would use a cryptographic content-hash (sha-256 of
 * canonical JSON serialisation). For the demo we use a deterministic
 * 4-char digest derived from a simple djb2 over the artefact's
 * canonical string form. The output looks like 'sha-7f2a' so the
 * audience reads it as a content hash without us having to ship
 * crypto into the bundle.
 *
 * Determinism property: same input → same digest. This is what makes
 * the seal/bind workflow auditable.
 */

function djb2(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return h >>> 0;
}

/** Stable JSON stringification — sorts object keys at every level. */
function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalise).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalise(obj[k])}`)
    .join(',')}}`;
}

/**
 * Compute the demo sha-prefix for a given artefact payload.
 * Returns a string like 'sha-7f2a' (always lowercase, always 4 hex chars).
 *
 * djb2 mixes incoming bytes into low bits which then propagate upward
 * via multiplication; for short inputs this mostly affects the lower
 * half of the digest. We take the last 4 hex chars (low 16 bits) to
 * preserve sensitivity to small input differences.
 */
export function computeSha(payload: unknown): string {
  const h = djb2(canonicalise(payload));
  const hex = h.toString(16).padStart(8, '0').slice(-4);
  return `sha-${hex}`;
}
