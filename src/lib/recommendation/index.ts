export { aggregate } from './aggregate';
export { buildHeadline, summariseRecommendation } from './headline';
export { buildTargetProfile, runRecommendation } from './runRecommendation';
export type { RecommendationInputs } from './runRecommendation';
export {
  profileFromBinder,
  profileFromLoss,
  similarity,
  topSimilar,
} from './similarity';
export type { RiskProfile } from './similarity';
export { evaluateProfileMatch } from './factors/profileMatch';
export { evaluateHistoricalPerformance } from './factors/historicalPerformance';
export {
  computeHoldFloor,
  evaluatePricingCompetitiveness,
} from './factors/pricingCompetitiveness';
export { evaluateSubjectivityRisk } from './factors/subjectivityRisk';
export {
  evaluateBrokerRelationship,
  getBrokerHistory,
} from './factors/brokerRelationship';
export type { BrokerHistory } from './factors/brokerRelationship';
export type {
  FactorEvidence,
  FactorVote,
  FactorWeight,
  Recommendation,
  RecommendationConfidence,
  RecommendationFactor,
  RecommendationVerdict,
} from './types';
