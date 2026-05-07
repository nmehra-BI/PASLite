/**
 * Module 11 — renewal types.
 */

export type RenewalPhase =
  | 'idle'
  | 'triggered'
  | 'year1-review'
  | 'changes-captured'
  | 'year2-rated'
  | 'defence-priced'
  | 'option-selected'
  | 'recommendation-ready'
  | 'slip-ready'
  | 'ceremony-in-progress'
  | 'committed'
  | 'sent';

export type Year1Review = {
  earnedPremium: number;
  totalLosses: number;
  lossRatio: number;
  claimCount: number;
  claims: Array<{
    ref: string;
    siteName: string;
    date: string;
    category: string;
    amount: number;
  }>;
  mtaCount: number;
  mtaRefs: string[];
  subjectivitiesSatisfied: number;
  subjectivitiesTotal: number;
  brokerRelationship: {
    name: string;
    sentiment: 'strong' | 'neutral' | 'strained';
    note: string;
  };
  marginalia: string;
};

export type DefencePricingOption = {
  id: 'hold' | 'defend' | 'aggressive';
  premium: number;
  rationale: string;
  recommended: boolean;
};

export type RenewalRecommendationFactor = {
  id: string;
  label: string;
  vote: 'pro-bind' | 'pro-ntu' | 'pro-refer' | 'neutral';
  weight: 'high' | 'moderate' | 'low';
  rationale: string;
  metadata?: Record<string, unknown>;
};

export type RenewalHashRecord = {
  id: 'premium' | 'subjectivities' | 'sanctions' | 'capacity';
  status: 'pending' | 'confirmed' | 'overridden';
  artefactSha: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
};

export type RenewalReplay = {
  phase: RenewalPhase;
  triggeredAt: string | null;
  renewalId: string | null;
  priorPolicyRef: string | null;
  year1Review: Year1Review | null;
  insuredChanges: {
    newTurnover: number | null;
    materialAdditions: string[];
    brokerTargetPremium: number | null;
    competitivePressure: string | null;
    notes: string | null;
  };
  year2: {
    technicalPremium: number | null;
    sha: string | null;
    deltaFromYear1Annual: number | null;
  };
  defencePricing: {
    options: DefencePricingOption[];
    holdFloor: number | null;
  };
  selectedOption: {
    id: 'hold' | 'defend' | 'aggressive';
    premium: number;
    selectedBy: string;
    selectedAt: string;
  } | null;
  recommendation: {
    primary: 'bind' | 'refer' | 'ntu' | null;
    confidence: 'high' | 'moderate' | 'low' | null;
    headline: string | null;
    factorIds: string[];
  };
  slip: {
    slipRef: string | null;
    premium: number | null;
    sha: string | null;
    sentAt: string | null;
  };
  hashes: RenewalHashRecord[];
  successorPolicyRef: string | null;
  inceptionDate: string | null;
  expiryDate: string | null;
  committedAt: string | null;
  signedBy: string | null;
  scheduleSentAt: string | null;
};

export function freshRenewal(): RenewalReplay {
  return {
    phase: 'idle',
    triggeredAt: null,
    renewalId: null,
    priorPolicyRef: null,
    year1Review: null,
    insuredChanges: {
      newTurnover: null,
      materialAdditions: [],
      brokerTargetPremium: null,
      competitivePressure: null,
      notes: null,
    },
    year2: { technicalPremium: null, sha: null, deltaFromYear1Annual: null },
    defencePricing: { options: [], holdFloor: null },
    selectedOption: null,
    recommendation: { primary: null, confidence: null, headline: null, factorIds: [] },
    slip: { slipRef: null, premium: null, sha: null, sentAt: null },
    hashes: [],
    successorPolicyRef: null,
    inceptionDate: null,
    expiryDate: null,
    committedAt: null,
    signedBy: null,
    scheduleSentAt: null,
  };
}
