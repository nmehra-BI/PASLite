import type { Field } from '@/lib/field';

/**
 * Submission domain types. Module 1 declared the shape; module 2 adds
 * the fields the Greenline fixture and extraction schedule populate.
 *
 * Keep added fields additive &mdash; module 1's dep graph and store
 * already operate against this shape, so removing or renaming an
 * existing field is a breaking change that must be coordinated.
 */

export type Address = {
  line1: string;
  line2?: string;
  town: string;
  postcode: string;
};

/**
 * One operating site on the policy. Each site is named, sized, and
 * carries an environment-agency permit reference + expiry.
 */
export type Site = {
  id: string;
  name: Field<string>;
  sqm: Field<number>;
  permitRef: Field<string>;
  permitExpiry: Field<string>;
};

export type Insured = {
  legalName: Field<string>;
  tradingName: Field<string>;
  companiesHouseNumber: Field<string>;
  yearsTrading: Field<number>;
  /** FY24 turnover, the primary figure used by rating. */
  turnover: Field<number>;
  /** FY23 turnover, kept for trend &amp; conflict checks. */
  turnoverPrior: Field<number>;
};

export type Cover = {
  inceptionDate: Field<string>;
  expiryDate: Field<string>;
  publicLiabilityLimit: Field<number>;
  employersLiabilityLimit: Field<number>;
  environmentalImpairmentLimit: Field<number>;
  /** Free-text term, e.g. "12 months". */
  term: Field<string>;
};

export type LossRun = {
  year: number;
  type: string;
  amount: number;
  status: 'paid' | 'open' | 'declined';
  note?: string;
};

export type Submission = {
  id: string;
  folio: string;
  receivedAt: string;
  broker: Field<string>;
  insured: Insured;
  cover: Cover;
  sites: Site[];

  // module 2 additions
  materials: Field<string[]>;
  fireSuppressionDisclosed: Field<boolean>;
  lossRuns: Field<LossRun[]>;
  statedLossRatio: Field<number>;
  brokerTargetPremium: Field<number>;
};

/**
 * Lifecycle phase model — five milestones, three phases, two seams.
 *
 * Quote ─── (seam: submission becomes policy) ─── Bind ─── … ─── Renewal
 */
export type LifecyclePhase = 'pre-bind' | 'in-force' | 'expired';
export type LifecycleMilestone =
  | 'quote'
  | 'bind'
  | 'mta-04'
  | 'cancel'
  | 'renewal';

export type LifecycleSeam = 'submission-becomes-policy' | 'policy-terminates';
