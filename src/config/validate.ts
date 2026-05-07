/**
 * Runtime validation for tenant configurations. Mirrors the TypeScript
 * shape in `./types.ts`; both must be kept in sync. (Future
 * refactor: derive TS types from Zod via z.infer<>; left as-is for
 * now so the schema reads naturally without inference noise.)
 *
 * Throws ConfigValidationError on a mismatch — the loader fails loudly
 * at startup so we don't render against malformed config.
 */

import { z } from 'zod';
import type { TenantConfig } from './types';

const capacityProviderRefSchema = z.object({
  name: z.string().min(1),
  contactEmail: z.string().email(),
  bordereauFormat: z.enum(['lloyds-csv', 'json', 'xml']),
  reportingFrequency: z.enum(['monthly', 'quarterly']),
});

const lineOfBusinessRefSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  tier: z.string(),
  regulator: z.string().min(1),
  market: z.enum(['lloyds', 'company', 'mga-aggregator']),
});

const brokerProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  primaryContact: z.string().min(1),
  contactEmail: z.string().email(),
  relationshipDurationMonths: z.number().int().nonnegative(),
  submissionVolumePerMonth: z.number().int().nonnegative(),
  typicalLOBs: z.array(z.string()),
});

const tenantMetadataSchema = z.object({
  tenantId: z.string().min(1),
  mgaName: z.string().min(1),
  mgaDeskName: z.string().min(1),
  underwriterName: z.string().min(1),
  underwriterShortId: z.string().min(1),
  underwriterTitle: z.string().min(1),
  capacityProvider: capacityProviderRefSchema,
  lineOfBusiness: lineOfBusinessRefSchema,
  primaryBrokerExamples: z.array(brokerProfileSchema).min(1),
});

const appetiteLogicSchema = z.object({
  kind: z.enum([
    'lob-membership',
    'turnover-band',
    'site-count',
    'material-class',
    'geographic-scope',
    'industry-exclusion',
  ]),
  params: z.record(z.unknown()),
});

const appetiteRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  category: z.enum(['inclusion', 'exclusion', 'conditional']),
  logic: appetiteLogicSchema,
  citation: z.string(),
});

const appetiteRulesSchema = z.object({
  rules: z.array(appetiteRuleSchema),
  geographicScope: z.array(z.string()),
  materialClassesAllowed: z.array(z.string()),
  materialClassesExcluded: z.array(z.string()),
  industriesExcluded: z.array(z.string()),
  conditions: z.object({
    minTurnover: z.number().optional(),
    maxTurnover: z.number().optional(),
    minSites: z.number().int().optional(),
    maxSites: z.number().int().optional(),
  }),
});

const capacityConfigSchema = z.object({
  totalCapacity: z.number().nonnegative(),
  perRiskMaxLine: z.number().nonnegative(),
  perRiskMaxAggregate: z.number().nonnegative(),
  capacityProviderAllocation: z.number().min(0).max(1),
  mgaRetention: z.number().min(0).max(1),
  gauge: z.object({
    warnAtFraction: z.number().min(0).max(1),
    hardLimitFraction: z.number().min(0).max(1),
  }),
});

const ratingCellSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  type: z.enum(['percentage', 'absolute', 'multiplier', 'output']),
  defaultValue: z.number().optional(),
  computeRuleId: z.string().optional(),
  citationRule: z.string(),
});

const ratingConfigSchema = z.object({
  engineVersion: z.string().min(1),
  cells: z.array(ratingCellSchema),
  creditRules: z.array(
    z.object({
      id: z.string().min(1),
      condition: z.string(),
      adjustment: z.number(),
    }),
  ),
  sealedHashAlgorithm: z.enum(['sha-7', 'sha-256']),
});

const triageConfigSchema = z.object({
  checks: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      orderIndex: z.number().int(),
      logic: z.object({
        kind: z.enum([
          'appetite',
          'sanctions',
          'capacity',
          'subjectivity-precondition',
        ]),
        params: z.record(z.unknown()),
      }),
      passingCriteria: z.string(),
      overrideAllowed: z.boolean(),
      overrideRoles: z.array(z.string()),
    }),
  ),
  capacityCheckThresholds: z.object({
    warnAt: z.number(),
    hardLimit: z.number(),
  }),
});

const recommendationConfigSchema = z.object({
  factors: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      domain: z.enum(['origination', 'renewal', 'both']),
      defaultWeight: z.enum(['low', 'moderate', 'high']),
      renewalWeight: z.enum(['low', 'moderate', 'high']).optional(),
      computeRuleId: z.string(),
      rationaleTemplate: z.string(),
    }),
  ),
  confidenceBands: z.object({
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
});

const subjectivityCatalogSchema = z.object({
  types: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      categoryCode: z.string(),
      lifecycleEvent: z.enum(['bind', 'mta', 'renewal', 'all']),
      defaultDurationDays: z.number().int().nonnegative(),
      autoRollover: z.boolean(),
      lineOfBusiness: z.string(),
    }),
  ),
});

const wordingLibrarySchema = z.object({
  clauses: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      version: z.string(),
      bodyText: z.string(),
      governs: z.array(z.string()),
      effectiveDate: z.string(),
      schedule: z.string().optional(),
    }),
  ),
});

const cancellationConfigSchema = z.object({
  reasons: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      category: z.enum([
        'insured-initiated',
        'mga-initiated',
        'statutory',
        'underwriting-decision',
        'subjectivity-breach',
        'sanctions-hit',
      ]),
      refundBasis: z.enum([
        'pro-rata',
        'short-rate',
        'void-ab-initio',
        'full-retained',
      ]),
      commissionTreatment: z.enum(['partial', 'full', 'none', 'preserved']),
      wordingClauseId: z.string().min(1),
    }),
  ),
  shortRatePenalty: z.number().min(0).max(1),
  brokerageRate: z.number().min(0).max(1),
  partialClawbackFactor: z.number().min(0).max(1),
});

const competitorIntelSchema = z.object({
  competitors: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      profile: z.enum(['sharp', 'aggressive', 'standard', 'conservative']),
      typicalDiscountRange: z.object({
        min: z.number(),
        max: z.number(),
      }),
      patternNotes: z.string(),
      relevantLOBs: z.array(z.string()),
    }),
  ),
});

const enrichmentSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum([
    'corporate-registry',
    'permit-registry',
    'credit-bureau',
    'internal-loss-index',
    'sanctions',
  ]),
  geographicScope: z.array(z.string()),
  defaultConfidence: z.number().min(0).max(1),
  citationFormat: z.string(),
});

/** Module 14's AutonomyPolicy is structurally complex; we accept it
 *  through z.unknown() and trust the platform's own type-checking.
 *  The platform-level types catch any shape drift at compile-time. */
const autonomyDefaultsSchema = z.object({
  policy: z.unknown(),
  decisionClasses: z.array(z.unknown()),
  bordereauFormat: z.string().min(1),
});

const brandingConfigSchema = z.object({
  productName: z.string().min(1),
  productMark: z.string().optional(),
  accentColor: z.string().min(1),
  typography: z.object({
    serif: z.string().min(1),
    sans: z.string().min(1),
    mono: z.string().min(1),
  }),
});

export const tenantConfigSchema = z.object({
  metadata: tenantMetadataSchema,
  appetite: appetiteRulesSchema,
  capacity: capacityConfigSchema,
  rating: ratingConfigSchema,
  triage: triageConfigSchema,
  recommendation: recommendationConfigSchema,
  subjectivities: subjectivityCatalogSchema,
  wording: wordingLibrarySchema,
  cancellation: cancellationConfigSchema,
  competitors: competitorIntelSchema,
  enrichmentSources: z.array(enrichmentSourceSchema),
  autonomy: autonomyDefaultsSchema,
  branding: brandingConfigSchema,
});

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/** Throws if the candidate is not a valid TenantConfig. Returns the
 *  validated config (typed) on success. */
export function validateConfig(candidate: unknown): TenantConfig {
  const result = tenantConfigSchema.safeParse(candidate);
  if (!result.success) {
    throw new ConfigValidationError(
      `TenantConfig validation failed: ${result.error.issues.length} issue(s).`,
      result.error.issues,
    );
  }
  // Cast through unknown — the Zod schema accepts the structural
  // contract but uses z.unknown() for the autonomy defaults; the
  // tenant config file is type-checked against TenantConfig at
  // import-time so the cast is safe.
  return candidate as TenantConfig;
}
