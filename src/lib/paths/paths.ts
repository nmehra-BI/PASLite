/**
 * Tiny path utilities for navigating the Submission tree.
 *
 * Paths use dot/bracket notation: `insured.turnover`,
 * `sites[0].storageTonnage`. The glob form `sites[*].storageTonnage`
 * is for *patterns* in the dependency graph; runtime field paths
 * always carry concrete indices.
 *
 * No external dependency on lodash &mdash; the parser is small and
 * the surface area is narrow.
 */

export type FieldPath = string & { readonly __fieldPath: unique symbol };

export function fieldPath(p: string): FieldPath {
  return p as FieldPath;
}

type Segment =
  | { kind: 'key'; name: string }
  | { kind: 'index'; index: number };

type PatternSegment =
  | Segment
  | { kind: 'wildcard' };

export function parsePath(path: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  while (i < path.length) {
    const ch = path[i];
    if (ch === '.') {
      i++;
      continue;
    }
    if (ch === '[') {
      const end = path.indexOf(']', i);
      if (end === -1) throw new Error(`Unclosed bracket in path: ${path}`);
      const inner = path.slice(i + 1, end);
      if (inner === '*') {
        throw new Error(
          `Wildcard '[*]' is only valid in patterns, not actual paths: ${path}`,
        );
      }
      const idx = Number(inner);
      if (!Number.isInteger(idx) || idx < 0) {
        throw new Error(`Invalid array index in path: ${path}`);
      }
      segments.push({ kind: 'index', index: idx });
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < path.length && path[j] !== '.' && path[j] !== '[') j++;
    segments.push({ kind: 'key', name: path.slice(i, j) });
    i = j;
  }
  return segments;
}

export function parsePattern(pattern: string): PatternSegment[] {
  const segments: PatternSegment[] = [];
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '.') {
      i++;
      continue;
    }
    if (ch === '[') {
      const end = pattern.indexOf(']', i);
      if (end === -1) throw new Error(`Unclosed bracket in pattern: ${pattern}`);
      const inner = pattern.slice(i + 1, end);
      if (inner === '*') {
        segments.push({ kind: 'wildcard' });
      } else {
        const idx = Number(inner);
        if (!Number.isInteger(idx) || idx < 0) {
          throw new Error(`Invalid array index in pattern: ${pattern}`);
        }
        segments.push({ kind: 'index', index: idx });
      }
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < pattern.length && pattern[j] !== '.' && pattern[j] !== '[') j++;
    segments.push({ kind: 'key', name: pattern.slice(i, j) });
    i = j;
  }
  return segments;
}

export function getAtPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of parsePath(path)) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (seg.kind === 'key') {
      cur = (cur as Record<string, unknown>)[seg.name];
    } else {
      cur = (cur as unknown[])[seg.index];
    }
  }
  return cur;
}

/**
 * Mutates `obj` to set the value at `path`. Throws if any intermediate
 * segment is missing (we never auto-create branches in regulated state).
 */
export function setAtPath(obj: unknown, path: string, value: unknown): void {
  const segs = parsePath(path);
  if (segs.length === 0) throw new Error('Cannot set at empty path');
  let cur: unknown = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    if (cur == null || typeof cur !== 'object') {
      throw new Error(`Path '${path}' missing at segment ${i}`);
    }
    cur =
      seg.kind === 'key'
        ? (cur as Record<string, unknown>)[seg.name]
        : (cur as unknown[])[seg.index];
  }
  if (cur == null || typeof cur !== 'object') {
    throw new Error(`Path '${path}' parent is not an object`);
  }
  const last = segs[segs.length - 1]!;
  if (last.kind === 'key') {
    (cur as Record<string, unknown>)[last.name] = value;
  } else {
    (cur as unknown[])[last.index] = value;
  }
}

/**
 * pathMatches('sites[*].storageTonnage', 'sites[0].storageTonnage') === true
 * pathMatches('insured.turnover',         'insured.turnover')       === true
 * pathMatches('insured.turnover',         'cover.turnover')         === false
 */
export function pathMatches(pattern: string, actual: string): boolean {
  const pSegs = parsePattern(pattern);
  const aSegs = parsePath(actual);
  if (pSegs.length !== aSegs.length) return false;
  for (let i = 0; i < pSegs.length; i++) {
    const p = pSegs[i]!;
    const a = aSegs[i]!;
    if (p.kind === 'key' && a.kind === 'key') {
      if (p.name !== a.name) return false;
    } else if (p.kind === 'wildcard' && a.kind === 'index') {
      // wildcard matches any index
    } else if (p.kind === 'index' && a.kind === 'index') {
      if (p.index !== a.index) return false;
    } else {
      return false;
    }
  }
  return true;
}
