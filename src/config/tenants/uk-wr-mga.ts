/**
 * UK Waste & Recycling MGA — Tenant configuration.
 *
 * Source of truth for W&R-specific content currently consumed by the
 * platform. Values extracted from existing fixtures and components;
 * each field's origin is annotated so future changes can be made
 * here rather than spread across modules.
 *
 * Adding a new W&R appetite rule, rating cell, subjectivity, or
 * cancellation reason: edit this file. The fixtures and components
 * read from the active config via useConfig() / loadConfig().
 *
 * NOTE: this file is being populated incrementally. Phase 1 of the
 * extraction landed the schema; Phase 2 (this file) populates the
 * surface-level metadata and content. Phase 3 is wiring the
 * components to read from here. A few sub-trees (rating cells,
 * autonomy policy body, full triage logic) are placeholder-shaped
 * pending their dedicated wiring step — see TENANT_CONFIG_TODO.md.
 */

import { getSeedAutonomyPolicy } from '@/lib/fixtures/autonomyPolicy';
import type { TenantConfig } from '../types';

export const ukWrMgaConfig: TenantConfig = {
  metadata: {
    tenantId: 'uk-wr-mga',
    mgaName: 'RanBerri Operations',
    mgaDeskName: 'MGA UK W&R desk',
    underwriterName: 'N. Sharma',
    underwriterShortId: 'nm',
    underwriterTitle: 'Senior underwriter',
    capacityProvider: {
      name: 'Syndicate 2358',
      contactEmail: 'report-recipient@2358.lloyd.com',
      bordereauFormat: 'lloyds-csv',
      reportingFrequency: 'monthly',
    },
    lineOfBusiness: {
      code: 'UK-W&R',
      label: 'UK Waste & Recycling',
      tier: 'Tier-2',
      regulator: 'FCA',
      market: 'lloyds',
    },
    // Greenline's policy is treated as having 3 prior administrative
    // endorsements (original schedule + 2 housekeeping). That offset
    // makes the first MTA render as MTA-04 — the original demo
    // narrative — without seeding fake admin-endorsement records
    // into policy.versions. A future tenant's first MTA would
    // render as MTA-(N+1) for whatever N they configure.
    priorAdministrativeEndorsements: 3,
    primaryBrokerExamples: [
      {
        id: 'BROKER-SURESTEP',
        name: 'SureStep Brokers Ltd',
        primaryContact: 'Sarah Whitfield',
        contactEmail: 's.whitfield@surestep.co.uk',
        relationshipDurationMonths: 28,
        submissionVolumePerMonth: 12,
        typicalLOBs: ['UK-W&R'],
      },
      {
        id: 'BROKER-PENDLE',
        name: 'Pendle & Co',
        primaryContact: 'James Pendle',
        contactEmail: 'jpendle@pendleandco.co.uk',
        relationshipDurationMonths: 18,
        submissionVolumePerMonth: 8,
        typicalLOBs: ['UK-W&R'],
      },
      {
        id: 'BROKER-MARLOWE',
        name: 'Marlowe Insurance Brokers',
        primaryContact: 'Anna Marlowe',
        contactEmail: 'a.marlowe@marlowebrokers.co.uk',
        relationshipDurationMonths: 22,
        submissionVolumePerMonth: 6,
        typicalLOBs: ['UK-W&R'],
      },
      {
        id: 'BROKER-CAULFIELD',
        name: 'Caulfield Brokers',
        primaryContact: 'David Caulfield',
        contactEmail: 'dcaulfield@caulfieldbrokers.co.uk',
        relationshipDurationMonths: 14,
        submissionVolumePerMonth: 5,
        typicalLOBs: ['UK-W&R'],
      },
    ],
  },

  appetite: {
    // Source of truth: src/lib/appetite/checkAppetite.ts.
    // Values here MUST stay aligned with that file's constants;
    // any drift means tenant config has diverged from deployed
    // behaviour. checkAppetite reads its bands from the constants
    // exported below.
    rules: [
      {
        id: 'APP-001',
        label: 'Line of business',
        description: 'UK waste & recycling.',
        category: 'inclusion',
        logic: { kind: 'lob-membership', params: { allowed: ['UK-W&R'] } },
        citation: 'Capacity authority schedule §2.1',
      },
      {
        id: 'APP-002',
        label: 'Jurisdiction',
        description: 'GB.',
        category: 'conditional',
        logic: {
          kind: 'geographic-scope',
          params: { allowed: ['GB'] },
        },
        citation: 'Capacity authority schedule §2.2',
      },
      {
        id: 'APP-003',
        label: 'Turnover band',
        description: 'Insureds with annual turnover £1m–£25m.',
        category: 'conditional',
        logic: {
          kind: 'turnover-band',
          params: { minGBP: 1_000_000, maxGBP: 25_000_000 },
        },
        citation: 'Capacity authority schedule §2.3',
      },
      {
        id: 'APP-004',
        label: 'Site count band',
        description: '1–5 sites. >5 by referral.',
        category: 'conditional',
        logic: {
          kind: 'site-count',
          params: { min: 1, max: 5, referralAbove: 5 },
        },
        citation: 'Capacity authority schedule §2.4',
      },
      {
        id: 'APP-005',
        label: 'Excluded material classes',
        description:
          'Battery, ELV, asbestos, hazardous waste, clinical waste, WEEE class 5+ excluded.',
        category: 'exclusion',
        logic: {
          kind: 'material-class',
          params: {
            excluded: [
              'battery',
              'elv',
              'asbestos',
              'hazardous waste',
              'clinical waste',
              'weee class 5',
              'weee 5+',
            ],
          },
        },
        citation: 'Capacity authority schedule §2.5',
      },
      {
        id: 'APP-006',
        label: 'Companies House status',
        description: 'Insured must be active on Companies House.',
        category: 'conditional',
        logic: {
          kind: 'industry-exclusion',
          params: { mustBeActive: true },
        },
        citation: 'Capacity authority schedule §2.6',
      },
    ],
    geographicScope: ['GB'],
    materialClassesAllowed: [],
    materialClassesExcluded: [
      'battery',
      'elv',
      'asbestos',
      'hazardous waste',
      'clinical waste',
      'weee class 5',
      'weee 5+',
    ],
    industriesExcluded: [],
    conditions: {
      minTurnover: 1_000_000,
      maxTurnover: 25_000_000,
      minSites: 1,
      maxSites: 5,
    },
  },

  capacity: {
    // Source: src/lib/fixtures/capacityLedger.ts.
    totalCapacity: 50_000_000,
    perRiskMaxLine: 5_000_000,
    perRiskMaxAggregate: 10_000_000,
    capacityProviderAllocation: 0.65,
    mgaRetention: 0.35,
    gauge: {
      warnAtFraction: 0.8,
      hardLimitFraction: 0.95,
    },
  },

  rating: {
    // Source: src/lib/rating/cells.ts. Cell bodies (compute logic)
    // remain in the rating engine; the config carries identifiers,
    // labels, and citation rule IDs only. Refactor step 5 will wire
    // engine version + citation lookups to this list.
    engineVersion: 'Tier-2 v3.2',
    cells: [
      {
        id: 'A1',
        label: 'Base rate · Tier-2',
        type: 'percentage',
        defaultValue: 0.025,
        citationRule: 'LRC-001',
      },
      {
        id: 'B14',
        label: 'Material class loading',
        type: 'multiplier',
        citationRule: 'LRC-002',
      },
      {
        id: 'C7',
        label: 'Site multiplier',
        type: 'multiplier',
        citationRule: 'LRC-003',
      },
      {
        id: 'D3',
        label: 'Loss credit',
        type: 'multiplier',
        citationRule: 'LRC-004',
      },
      {
        id: 'H58',
        label: 'Sealed premium',
        type: 'output',
        citationRule: 'LRC-005',
      },
    ],
    creditRules: [
      {
        id: 'LRC-001',
        condition: 'Insured has ≥3 years clean loss history',
        adjustment: -0.05,
      },
      {
        id: 'LRC-002',
        condition: 'Fire suppression system present at all sites',
        adjustment: -0.03,
      },
    ],
    sealedHashAlgorithm: 'sha-7',
  },

  triage: {
    // Source: src/features/triage + src/lib/appetite. The 4 checks
    // map 1:1 to the runtime check definitions. Refactor step 4
    // reads check labels and override roles from here.
    checks: [
      {
        id: 'TRIAGE-APPETITE',
        label: 'Appetite check',
        orderIndex: 1,
        logic: { kind: 'appetite', params: {} },
        passingCriteria:
          'All five appetite rules satisfied (APP-001 through APP-005).',
        overrideAllowed: true,
        overrideRoles: ['senior-underwriter'],
      },
      {
        id: 'TRIAGE-SANCTIONS',
        label: 'Sanctions screening',
        orderIndex: 2,
        logic: { kind: 'sanctions', params: { providers: ['HM-Treasury'] } },
        passingCriteria:
          'No partial-match or hit on insured, directors, or trading-as names.',
        overrideAllowed: false,
        overrideRoles: [],
      },
      {
        id: 'TRIAGE-CAPACITY',
        label: 'Capacity check',
        orderIndex: 3,
        logic: {
          kind: 'capacity',
          params: { warnAtFraction: 0.8, hardLimitFraction: 0.95 },
        },
        passingCriteria:
          'Capacity headroom remains > 5% of cap after this submission.',
        overrideAllowed: true,
        overrideRoles: ['senior-underwriter', 'mga-owner'],
      },
      {
        id: 'TRIAGE-SUBJECTIVITY',
        label: 'Subjectivity preconditions',
        orderIndex: 4,
        logic: { kind: 'subjectivity-precondition', params: {} },
        passingCriteria:
          'EA permit valid, fire suppression confirmed, no sanctions ambiguity.',
        overrideAllowed: true,
        overrideRoles: ['senior-underwriter'],
      },
    ],
    capacityCheckThresholds: {
      warnAt: 0.8,
      hardLimit: 0.95,
    },
  },

  recommendation: {
    // Source: src/lib/recommendation (modules 6 + 11). Renewal-weight
    // overrides come from the renewal recommendation builder.
    factors: [
      {
        id: 'FCT-001',
        label: 'Profile match strength',
        domain: 'both',
        defaultWeight: 'high',
        renewalWeight: 'low',
        computeRuleId: 'profile-similarity',
        rationaleTemplate:
          '{count} similar binders matched on materials + geography + turnover band.',
      },
      {
        id: 'FCT-002',
        label: 'Historical performance (same-MGA cohort)',
        domain: 'both',
        defaultWeight: 'high',
        renewalWeight: 'moderate',
        computeRuleId: 'cohort-loss-ratio',
        rationaleTemplate:
          'Cohort LR {lr}% across {n} bound binders; {profitable} performed within target.',
      },
      {
        id: 'FCT-003',
        label: 'Pricing competitiveness',
        domain: 'both',
        defaultWeight: 'moderate',
        computeRuleId: 'price-vs-sharp-floor',
        rationaleTemplate:
          'Selected price holds the {position} band against the sharp competitor floor.',
      },
      {
        id: 'FCT-004',
        label: 'Subjectivity risk',
        domain: 'both',
        defaultWeight: 'moderate',
        renewalWeight: 'low',
        computeRuleId: 'subjectivity-density',
        rationaleTemplate:
          '{satisfied} of {total} subjectivities satisfied; {open} remain monitored.',
      },
      {
        id: 'FCT-005',
        label: 'Broker relationship',
        domain: 'both',
        defaultWeight: 'moderate',
        computeRuleId: 'broker-sentiment',
        rationaleTemplate:
          '{broker} · {sentiment} sentiment over {months}-month relationship.',
      },
      {
        id: 'FCT-006',
        label: 'Year-1 performance (renewal-specific)',
        domain: 'renewal',
        defaultWeight: 'high',
        computeRuleId: 'year1-lr',
        rationaleTemplate:
          'Year-1 LR {lr}% on £{earned} earned. {claimCount} claims. {verdict}',
      },
      {
        id: 'FCT-007',
        label: 'Defence pricing fit',
        domain: 'renewal',
        defaultWeight: 'moderate',
        computeRuleId: 'defence-pricing-fit',
        rationaleTemplate:
          'Selected £{price} sits {position} between sharp floor and technical.',
      },
    ],
    confidenceBands: {
      high: 0.85,
      medium: 0.65,
      low: 0.4,
    },
  },

  subjectivities: {
    // Source: src/lib/fixtures/subjectivities.ts.
    types: [
      {
        id: 'SUBJ-EA-PERMIT',
        label: 'Environmental Agency permit',
        categoryCode: 'permit',
        lifecycleEvent: 'all',
        defaultDurationDays: 365,
        autoRollover: true,
        lineOfBusiness: 'UK-W&R',
      },
      {
        id: 'SUBJ-FIRE-SUPPRESSION',
        label: 'Fire suppression system in force',
        categoryCode: 'warranty',
        lifecycleEvent: 'bind',
        defaultDurationDays: 365,
        autoRollover: true,
        lineOfBusiness: 'UK-W&R',
      },
      {
        id: 'SUBJ-WEEE-WARRANTY',
        label: 'WEEE conditional warranty',
        categoryCode: 'warranty',
        lifecycleEvent: 'renewal',
        defaultDurationDays: 365,
        autoRollover: false,
        lineOfBusiness: 'UK-W&R',
      },
    ],
  },

  wording: {
    // Source: src/features/cancellation (cl.14 body text).
    clauses: [
      {
        id: 'CL-14',
        label: 'Cancellation by insured',
        version: 'v2.1',
        bodyText:
          'In the event of cancellation by the Insured prior to natural expiry, the Insurer shall be entitled to retain a short-rate proportion of the premium calculated on the customary short-rate scale, with a minimum retention of 7.5% of the annual premium. Commission paid to the producing broker on the cancelled portion shall be returned pro-rata.',
        governs: ['cancellation-insured-initiated'],
        effectiveDate: '2024-04-01',
        schedule: 'Schedule 2',
      },
      {
        id: 'CL-15',
        label: 'Cancellation by Insurer',
        version: 'v2.1',
        bodyText:
          'The Insurer may cancel this policy by giving 30 days written notice. Premium for the unexpired term shall be refunded pro-rata; commission shall be preserved.',
        governs: ['cancellation-mga-initiated'],
        effectiveDate: '2024-04-01',
        schedule: 'Schedule 2',
      },
    ],
  },

  cancellation: {
    // Source of truth: src/lib/cancellation/types.ts. IDs match the
    // canonical CancellationReason union; refund basis + clawback
    // rules round-trip exactly. The numerical constants below
    // (shortRatePenalty etc.) are read by computeRefund.
    reasons: [
      {
        id: 'insured-non-renewal',
        label: 'insured non-renewal',
        category: 'insured-initiated',
        refundBasis: 'short-rate',
        commissionTreatment: 'partial',
        wordingClauseId: 'CL-14',
      },
      {
        id: 'insured-cancel-other',
        label: 'insured request',
        category: 'insured-initiated',
        refundBasis: 'short-rate',
        commissionTreatment: 'partial',
        wordingClauseId: 'CL-14',
      },
      {
        id: 'non-payment',
        label: 'non-payment of premium',
        category: 'insured-initiated',
        refundBasis: 'short-rate',
        commissionTreatment: 'full',
        wordingClauseId: 'CL-14',
      },
      {
        id: 'mga-cancel-underwriting',
        label: 'underwriter cause',
        category: 'underwriting-decision',
        refundBasis: 'pro-rata',
        commissionTreatment: 'partial',
        wordingClauseId: 'CL-15',
      },
      {
        id: 'mga-cause-misrep',
        label: 'material misrepresentation — void ab initio',
        category: 'mga-initiated',
        refundBasis: 'void-ab-initio',
        commissionTreatment: 'full',
        wordingClauseId: 'CL-15',
      },
    ],
    shortRatePenalty: 0.075,
    brokerageRate: 0.215,
    partialClawbackFactor: 0.554,
  },

  competitors: {
    // Source: src/lib/fixtures/competitiveIntel.ts +
    // src/features/recommendation + module 11's defence pricing.
    // Names match the fixture's canonical entries — the fixture
    // reads from this list so renaming a competitor here propagates.
    competitors: [
      {
        id: 'COMP-REGENTMGA',
        name: 'RegentMGA',
        profile: 'sharp',
        typicalDiscountRange: { min: -0.15, max: -0.08 },
        patternNotes:
          'Consistently undercuts on Tier-2 W&R; LR pattern unknown but suspected high. Defence floor observed around £50,500 for sub-£15M turnover risks.',
        relevantLOBs: ['UK-W&R'],
      },
      {
        id: 'COMP-CAULFIELD',
        name: 'Caulfield Underwriting',
        profile: 'standard',
        typicalDiscountRange: { min: -0.02, max: 0.01 },
        patternNotes:
          'Broker-relationship driven; pricing rarely the deciding factor.',
        relevantLOBs: ['UK-W&R'],
      },
      {
        id: 'COMP-BOLTREE',
        name: 'Boltree Specialty',
        profile: 'conservative',
        typicalDiscountRange: { min: 0, max: 0.08 },
        patternNotes:
          'Rarely encountered in this segment; trades on broader sub-limits.',
        relevantLOBs: ['UK-W&R'],
      },
    ],
  },

  enrichmentSources: [
    // Source: src/lib/fixtures/enrichmentSources.ts (module 3). IDs
    // match the fixture's local enum so the engine can index by id;
    // labels and citation formats round-trip into bordereau citations.
    {
      id: 'companies-house',
      label: 'Companies House',
      type: 'corporate-registry',
      geographicScope: ['UK'],
      defaultConfidence: 0.95,
      citationFormat: 'CH-{companyNumber}',
    },
    {
      id: 'ea-permit-registry',
      label: 'EA Permit Registry',
      type: 'permit-registry',
      geographicScope: ['UK'],
      defaultConfidence: 0.92,
      citationFormat: 'EAWML-{permitNumber}',
    },
    {
      id: 'experian-sanctions',
      label: 'Experian Sanctions',
      type: 'sanctions',
      geographicScope: ['UK'],
      defaultConfidence: 0.99,
      citationFormat: 'EXP-{listRef}',
    },
    {
      id: 'internal-loss-index',
      label: 'Internal Loss Index',
      type: 'internal-loss-index',
      geographicScope: ['UK'],
      defaultConfidence: 0.97,
      citationFormat: 'ILI-{recordRef}',
    },
  ],

  autonomy: {
    // Module 14's autonomy policy is the canonical shape. The seed
    // function takes options for the metadata strings so this config
    // injects its own capacity-provider + MGA-owner names without
    // requiring autonomyPolicy.ts to import @/config (which would
    // create a circular dependency).
    policy: getSeedAutonomyPolicy({
      capacityProvider: 'Syndicate 2358',
      mgaOwner: 'RanBerri Operations',
    }),
    decisionClasses: Object.values(
      getSeedAutonomyPolicy({
        capacityProvider: 'Syndicate 2358',
        mgaOwner: 'RanBerri Operations',
      }).decisionClasses,
    ),
    bordereauFormat: 'lloyds-csv',
  },

  branding: {
    productName: 'RanBerri',
    accentColor: '#C96342',
    typography: {
      serif: 'Source Serif 4',
      sans: 'Inter',
      mono: 'JetBrains Mono',
    },
  },
};
