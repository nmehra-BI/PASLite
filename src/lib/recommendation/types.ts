import type { CompetitorProfile, HistoricalBinder, LossToCompetitor } from '@/lib/fixtures';

export type RecommendationVerdict = 'bind' | 'refer' | 'ntu';
export type RecommendationConfidence = 'high' | 'moderate' | 'low';

export type FactorVote = 'pro-bind' | 'pro-ntu' | 'pro-refer' | 'neutral';
export type FactorWeight = 'high' | 'moderate' | 'low';

export type FactorEvidence = {
  binderIds?: string[];
  lossIds?: string[];
  ratingCells?: string[];
  competitorNames?: string[];
};

export type RecommendationFactor = {
  id: string;
  label: string;
  vote: FactorVote;
  weight: FactorWeight;
  rationale: string;
  evidence: FactorEvidence;
  /** Optional structured payload the detail card can render. */
  metadata?: Record<string, unknown>;
};

export type Recommendation = {
  primary: RecommendationVerdict;
  confidence: RecommendationConfidence;
  factors: RecommendationFactor[];
  similarBinders: HistoricalBinder[];
  similarLosses: LossToCompetitor[];
  competitorContext: CompetitorProfile[];
  /** Two- to three-sentence narrative. */
  headline: string;
  generatedAt: string;
};
