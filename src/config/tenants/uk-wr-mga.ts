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
    // Source: src/lib/appetite (rule definitions + module 4 triage).
    // Refactor step 2 will replace appetite usages to read from here.
    rules: [
      {
        id: 'APP-001',
        label: 'In-appetite line of business',
        description: 'UK Waste & Recycling at Tier-2 cap.',
        category: 'inclusion',
        logic: { kind: 'lob-membership', params: { allowed: ['UK-W&R'] } },
        citation: 'Capacity authority schedule §2.1',
      },
      {
        id: 'APP-002',
        label: 'Turnover in band',
        description: 'Insureds with annual turnover £1m–£50m.',
        category: 'conditional',
        logic: {
          kind: 'turnover-band',
          params: { minGBP: 1_000_000, maxGBP: 50_000_000 },
        },
        citation: 'Capacity authority schedule §2.2',
      },
      {
        id: 'APP-003',
        label: 'Material class allowed',
        description:
          'Mixed dry recyclables, paper & card, plastics. Hazardous waste excluded; WEEE conditional.',
        category: 'conditional',
        logic: {
          kind: 'material-class',
          params: {
            allowed: ['dry-recyclables', 'paper-card', 'plastics', 'metals'],
            conditional: ['weee'],
            excluded: ['hazardous', 'asbestos', 'medical-waste'],
          },
        },
        citation: 'Capacity authority schedule §2.3',
      },
      {
        id: 'APP-004',
        label: 'Geographic scope',
        description: 'UK only. Republic of Ireland on referral.',
        category: 'conditional',
        logic: {
          kind: 'geographic-scope',
          params: { allowed: ['UK'], referralOnly: ['IE'] },
        },
        citation: 'Capacity authority schedule §2.4',
      },
      {
        id: 'APP-005',
        label: 'Site count',
        description: 'Up to 10 sites; >10 by referral.',
        category: 'conditional',
        logic: {
          kind: 'site-count',
          params: { max: 10, referralAbove: 10 },
        },
        citation: 'Capacity authority schedule §2.5',
      },
    ],
    geographicScope: ['UK'],
    materialClassesAllowed: [
      'dry-recyclables',
      'paper-card',
      'plastics',
      'metals',
      'mixed-recyclables',
    ],
    materialClassesExcluded: ['hazardous', 'asbestos', 'medical-waste'],
    industriesExcluded: ['heavy-demolition', 'nuclear-waste'],
    conditions: {
      minTurnover: 1_000_000,
      maxTurnover: 50_000_000,
      minSites: 1,
      maxSites: 10,
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
    // Source: src/lib/cancellation (5 reason types + refund mechanics).
    reasons: [
      {
        id: 'INSURED-SWITCH',
        label: 'Insured switching carrier',
        category: 'insured-initiated',
        refundBasis: 'short-rate',
        shortRatePenalty: 0.075,
        commissionTreatment: 'partial',
        wordingClauseId: 'CL-14',
      },
      {
        id: 'INSURED-CEASED-TRADING',
        label: 'Insured ceased trading',
        category: 'insured-initiated',
        refundBasis: 'pro-rata',
        commissionTreatment: 'partial',
        wordingClauseId: 'CL-14',
      },
      {
        id: 'MGA-WITHDRAWAL',
        label: 'MGA withdrawing capacity from segment',
        category: 'mga-initiated',
        refundBasis: 'pro-rata',
        commissionTreatment: 'preserved',
        wordingClauseId: 'CL-15',
      },
      {
        id: 'SUBJECTIVITY-BREACH',
        label: 'Subjectivity breach (e.g. permit lapse)',
        category: 'subjectivity-breach',
        refundBasis: 'pro-rata',
        commissionTreatment: 'partial',
        wordingClauseId: 'CL-15',
      },
      {
        id: 'SANCTIONS-HIT',
        label: 'Sanctions hit detected post-bind',
        category: 'sanctions-hit',
        refundBasis: 'full-retained',
        commissionTreatment: 'full',
        wordingClauseId: 'CL-15',
      },
    ],
  },

  competitors: {
    // Source: src/lib/fixtures/competitiveIntel.ts +
    // src/features/recommendation + module 11's defence pricing.
    competitors: [
      {
        id: 'COMP-REGENTMGA',
        name: 'RegentMGA',
        profile: 'sharp',
        typicalDiscountRange: { min: -0.15, max: -0.08 },
        patternNotes:
          'Aggressive on Tier-2 W&R; willing to defend at thin margin to retain book share. Defence floor observed around £50,500 for sub-£15M turnover risks.',
        relevantLOBs: ['UK-W&R'],
      },
      {
        id: 'COMP-NORTHWAY',
        name: 'Northway Underwriting',
        profile: 'standard',
        typicalDiscountRange: { min: -0.05, max: 0.02 },
        patternNotes:
          'Steady on Tier-2 W&R; quotes near technical without discount, loses on price-led broker shops.',
        relevantLOBs: ['UK-W&R'],
      },
      {
        id: 'COMP-LANDMARK',
        name: 'Landmark Specialty',
        profile: 'conservative',
        typicalDiscountRange: { min: 0, max: 0.08 },
        patternNotes:
          'Will quote above technical when capacity headroom is constrained; not currently a primary threat in W&R.',
        relevantLOBs: ['UK-W&R'],
      },
    ],
  },

  enrichmentSources: [
    // Source: src/lib/fixtures/enrichmentSources.ts (module 3).
    {
      id: 'COMPANIES-HOUSE',
      label: 'Companies House',
      type: 'corporate-registry',
      geographicScope: ['UK'],
      defaultConfidence: 0.95,
      citationFormat: 'CH-{companyNumber}',
    },
    {
      id: 'EA-REGISTRY',
      label: 'Environmental Agency permit registry',
      type: 'permit-registry',
      geographicScope: ['UK'],
      defaultConfidence: 0.92,
      citationFormat: 'EAWML-{permitNumber}',
    },
    {
      id: 'EXPERIAN',
      label: 'Experian credit bureau',
      type: 'credit-bureau',
      geographicScope: ['UK'],
      defaultConfidence: 0.88,
      citationFormat: 'EXP-{reportRef}',
    },
    {
      id: 'INTERNAL-LOSS-INDEX',
      label: 'Internal loss index',
      type: 'internal-loss-index',
      geographicScope: ['UK'],
      defaultConfidence: 0.97,
      citationFormat: 'ILI-{recordRef}',
    },
    {
      id: 'HM-TREASURY-SANCTIONS',
      label: 'HM Treasury sanctions list',
      type: 'sanctions',
      geographicScope: ['UK'],
      defaultConfidence: 0.99,
      citationFormat: 'HMT-{listRef}',
    },
  ],

  autonomy: {
    // Module 14's autonomy policy is the canonical shape for now.
    // The config carries the seed; a future tenant ships its own.
    policy: getSeedAutonomyPolicy(),
    decisionClasses: Object.values(getSeedAutonomyPolicy().decisionClasses),
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
