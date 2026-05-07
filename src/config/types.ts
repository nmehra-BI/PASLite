/**
 * Tenant configuration schema.
 *
 * The platform (modules 1–15) reads its W&R-specific content from a
 * TenantConfig object. The current single-tenant deployment loads
 * `src/config/tenants/uk-wr-mga.ts`. A future tenant ships a sibling
 * config file conforming to this schema; no platform code changes.
 *
 * What's in scope: appetite, rating cells, triage rules,
 * recommendation factors, subjectivities, wording library,
 * cancellation reasons, competitor intel, enrichment sources, broker
 * profiles, branding, autonomy defaults.
 *
 * What's NOT in scope: per-tenant routing, tenant-isolated state, a
 * tenant switcher UI. This is content extraction, not multi-tenancy.
 */

import type {
  AutonomyPolicy,
  DecisionClassConfig,
} from '@/lib/autonomy/types';

export type TenantConfig = {
  metadata: TenantMetadata;
  appetite: AppetiteRules;
  capacity: CapacityConfig;
  rating: RatingConfig;
  triage: TriageConfig;
  recommendation: RecommendationConfig;
  subjectivities: SubjectivityCatalog;
  wording: WordingLibrary;
  cancellation: CancellationConfig;
  competitors: CompetitorIntel;
  enrichmentSources: EnrichmentSourceConfig[];
  autonomy: AutonomyPolicyDefaults;
  branding: BrandingConfig;
};

// ─── Metadata ──────────────────────────────────────────────────────

export type TenantMetadata = {
  /** Stable id for the tenant, used in audit references and logs. */
  tenantId: string;
  mgaName: string;
  mgaDeskName: string;
  /** The default underwriter the demo runs as. Production: derived
   *  from auth, not config. */
  underwriterName: string;
  underwriterShortId: string;
  underwriterTitle: string;
  capacityProvider: CapacityProviderRef;
  lineOfBusiness: LineOfBusinessRef;
  primaryBrokerExamples: BrokerProfile[];
};

export type CapacityProviderRef = {
  name: string;
  contactEmail: string;
  bordereauFormat: 'lloyds-csv' | 'json' | 'xml';
  reportingFrequency: 'monthly' | 'quarterly';
};

export type LineOfBusinessRef = {
  code: string;
  label: string;
  tier: string;
  regulator: string;
  market: 'lloyds' | 'company' | 'mga-aggregator';
};

export type BrokerProfile = {
  id: string;
  name: string;
  primaryContact: string;
  contactEmail: string;
  relationshipDurationMonths: number;
  submissionVolumePerMonth: number;
  typicalLOBs: string[];
};

// ─── Appetite ──────────────────────────────────────────────────────

export type AppetiteLogicKind =
  | 'lob-membership'
  | 'turnover-band'
  | 'site-count'
  | 'material-class'
  | 'geographic-scope'
  | 'industry-exclusion';

export type AppetiteLogic = {
  kind: AppetiteLogicKind;
  /** Free-form parameters interpreted by the rule engine. Kept loose
   *  so a tenant can express logic the platform hasn't formalized
   *  yet without breaking the schema. */
  params: Record<string, unknown>;
};

export type AppetiteRule = {
  id: string;
  label: string;
  description: string;
  category: 'inclusion' | 'exclusion' | 'conditional';
  logic: AppetiteLogic;
  citation: string;
};

export type AppetiteRules = {
  rules: AppetiteRule[];
  geographicScope: string[];
  materialClassesAllowed: string[];
  materialClassesExcluded: string[];
  industriesExcluded: string[];
  conditions: {
    minTurnover?: number;
    maxTurnover?: number;
    minSites?: number;
    maxSites?: number;
  };
};

// ─── Capacity ──────────────────────────────────────────────────────

export type CapacityConfig = {
  totalCapacity: number;
  perRiskMaxLine: number;
  perRiskMaxAggregate: number;
  capacityProviderAllocation: number;
  mgaRetention: number;
  /** Display thresholds for the capacity gauge. */
  gauge: {
    warnAtFraction: number;
    hardLimitFraction: number;
  };
};

// ─── Rating ────────────────────────────────────────────────────────

export type RatingCellType =
  | 'percentage'
  | 'absolute'
  | 'multiplier'
  | 'output';

export type RatingCell = {
  id: string;
  label: string;
  type: RatingCellType;
  defaultValue?: number;
  /** Identifier into the rating engine's rule library; the engine
   *  resolves this at compute-time. The schema does not constrain
   *  the rule body itself. */
  computeRuleId?: string;
  citationRule: string;
};

export type RatingCreditRule = {
  id: string;
  condition: string;
  adjustment: number;
};

export type RatingConfig = {
  engineVersion: string;
  cells: RatingCell[];
  creditRules: RatingCreditRule[];
  sealedHashAlgorithm: 'sha-7' | 'sha-256';
};

// ─── Triage ────────────────────────────────────────────────────────

export type TriageLogicKind =
  | 'appetite'
  | 'sanctions'
  | 'capacity'
  | 'subjectivity-precondition';

export type TriageLogic = {
  kind: TriageLogicKind;
  params: Record<string, unknown>;
};

export type TriageCheck = {
  id: string;
  label: string;
  orderIndex: number;
  logic: TriageLogic;
  passingCriteria: string;
  overrideAllowed: boolean;
  overrideRoles: string[];
};

export type TriageConfig = {
  checks: TriageCheck[];
  capacityCheckThresholds: {
    warnAt: number;
    hardLimit: number;
  };
};

// ─── Recommendation ────────────────────────────────────────────────

export type RecommendationFactorDef = {
  id: string;
  label: string;
  domain: 'origination' | 'renewal' | 'both';
  defaultWeight: 'low' | 'moderate' | 'high';
  /** When set, the factor uses this weight at renewal instead of its
   *  default. (FCT-001 deweights at renewal because the policy IS
   *  the ground truth; FCT-006 outweights at renewal.) */
  renewalWeight?: 'low' | 'moderate' | 'high';
  computeRuleId: string;
  rationaleTemplate: string;
};

export type RecommendationConfig = {
  factors: RecommendationFactorDef[];
  confidenceBands: {
    high: number;
    medium: number;
    low: number;
  };
};

// ─── Subjectivities ────────────────────────────────────────────────

export type SubjectivityType = {
  id: string;
  label: string;
  categoryCode: string;
  lifecycleEvent: 'bind' | 'mta' | 'renewal' | 'all';
  defaultDurationDays: number;
  autoRollover: boolean;
  lineOfBusiness: string;
};

export type SubjectivityCatalog = {
  types: SubjectivityType[];
};

// ─── Wording ───────────────────────────────────────────────────────

export type WordingClause = {
  id: string;
  label: string;
  version: string;
  bodyText: string;
  governs: string[];
  effectiveDate: string;
  schedule?: string;
};

export type WordingLibrary = {
  clauses: WordingClause[];
};

// ─── Cancellation ──────────────────────────────────────────────────

export type CancellationReasonCategory =
  | 'insured-initiated'
  | 'mga-initiated'
  | 'statutory'
  | 'underwriting-decision'
  | 'subjectivity-breach'
  | 'sanctions-hit';

export type CancellationReason = {
  id: string;
  label: string;
  category: CancellationReasonCategory;
  refundBasis: 'pro-rata' | 'short-rate' | 'void-ab-initio' | 'full-retained';
  /** 'partial' | 'full' | 'none' — the canonical clawback kinds the
   *  refund engine knows how to apply. 'preserved' kept as an alias
   *  for tenants that prefer that wording in their wording library. */
  commissionTreatment: 'partial' | 'full' | 'none' | 'preserved';
  wordingClauseId: string;
};

export type CancellationConfig = {
  reasons: CancellationReason[];
  /** Short-rate penalty applied to short-rate cancellations (per
   *  cl.14 in the wording library). 0.075 = 7.5%. */
  shortRatePenalty: number;
  /** Brokerage rate baked into commission/clawback computation. */
  brokerageRate: number;
  /** Partial-clawback factor for voluntary short-rate cancellations. */
  partialClawbackFactor: number;
};

// ─── Competitor intel ──────────────────────────────────────────────

export type CompetitorProfile = {
  id: string;
  name: string;
  profile: 'sharp' | 'aggressive' | 'standard' | 'conservative';
  typicalDiscountRange: { min: number; max: number };
  patternNotes: string;
  relevantLOBs: string[];
};

export type CompetitorIntel = {
  competitors: CompetitorProfile[];
};

// ─── Enrichment sources ────────────────────────────────────────────

export type EnrichmentSourceType =
  | 'corporate-registry'
  | 'permit-registry'
  | 'credit-bureau'
  | 'internal-loss-index'
  | 'sanctions';

export type EnrichmentSourceConfig = {
  id: string;
  label: string;
  type: EnrichmentSourceType;
  geographicScope: string[];
  defaultConfidence: number;
  citationFormat: string;
};

// ─── Autonomy defaults ─────────────────────────────────────────────

/** Module 14's autonomy types are the canonical shape. The config
 *  carries the same shape so tenants can ship their own defaults. */
export type AutonomyPolicyDefaults = {
  policy: AutonomyPolicy;
  decisionClasses: DecisionClassConfig[];
  bordereauFormat: string;
};

// ─── Branding ──────────────────────────────────────────────────────

export type BrandingConfig = {
  productName: string;
  productMark?: string;
  accentColor: string;
  typography: {
    serif: string;
    sans: string;
    mono: string;
  };
};
