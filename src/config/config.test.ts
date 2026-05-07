import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigValidationError, validateConfig, tenantConfigSchema } from './index';
import { ukWrMgaConfig } from './tenants/uk-wr-mga';

describe('tenant config — W&R', () => {
  it('loads and validates against the schema', () => {
    const cfg = loadConfig();
    expect(cfg.metadata.tenantId).toBe('uk-wr-mga');
    expect(cfg.metadata.mgaName).toBe('RanBerri Operations');
    expect(cfg.metadata.capacityProvider.name).toBe('Syndicate 2358');
    expect(cfg.metadata.lineOfBusiness.code).toBe('UK-W&R');
  });

  it('exposes all five seeded autonomy decision classes', () => {
    const cfg = loadConfig();
    expect(cfg.autonomy.decisionClasses).toHaveLength(5);
    const ids = cfg.autonomy.decisionClasses.map((c) => c.id).sort();
    expect(ids).toEqual([
      'BIND-AUTO-COMMIT',
      'CONFLICT-AUTO-RESOLVE',
      'NTU-AUTO-CAPTURE',
      'TRIAGE-AUTO-DECLINE',
      'TRIAGE-AUTO-PASS',
    ]);
  });

  it('contains the canonical 5 cancellation reasons', () => {
    const cfg = loadConfig();
    expect(cfg.cancellation.reasons.length).toBe(5);
    const ids = cfg.cancellation.reasons.map((r) => r.id);
    expect(ids).toContain('INSURED-SWITCH');
    expect(ids).toContain('SANCTIONS-HIT');
  });

  it('is a singleton — loadConfig returns the same instance', () => {
    expect(loadConfig()).toBe(loadConfig());
  });
});

describe('validateConfig — schema rejection', () => {
  it('throws ConfigValidationError on missing required fields', () => {
    expect(() => validateConfig({})).toThrow(ConfigValidationError);
  });

  it('throws on invalid email in capacity provider contact', () => {
    const broken = {
      ...ukWrMgaConfig,
      metadata: {
        ...ukWrMgaConfig.metadata,
        capacityProvider: {
          ...ukWrMgaConfig.metadata.capacityProvider,
          contactEmail: 'not-an-email',
        },
      },
    };
    expect(() => validateConfig(broken)).toThrow(ConfigValidationError);
  });

  it('Zod schema accepts the full W&R config', () => {
    const result = tenantConfigSchema.safeParse(ukWrMgaConfig);
    expect(result.success).toBe(true);
  });
});
