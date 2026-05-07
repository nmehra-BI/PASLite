/**
 * Synchronous loader for the active tenant config.
 *
 * Single-tenant by design: imports the W&R config directly. A future
 * second tenant ships its own file; this loader stays a single line.
 * No URL-based selection, no per-request switching.
 *
 * The loaded config is validated against the Zod schema at startup.
 * Validation failure throws ConfigValidationError — we'd rather crash
 * loudly than render against malformed config.
 *
 * Two access patterns:
 *   - useConfig() — React components, via context
 *   - getActiveConfig() — non-React modules (fixtures, library code,
 *     module-scope closures); returns the validated singleton
 */

import { ukWrMgaConfig } from './tenants/uk-wr-mga';
import type { TenantConfig } from './types';
import { validateConfig } from './validate';

let _active: TenantConfig | null = null;

export function loadConfig(): TenantConfig {
  if (_active === null) {
    _active = validateConfig(ukWrMgaConfig);
  }
  return _active;
}

/** Non-React access to the active tenant config. Lazily initializes
 *  the same singleton loadConfig() returns; safe to call at module
 *  scope. */
export function getActiveConfig(): TenantConfig {
  return loadConfig();
}
