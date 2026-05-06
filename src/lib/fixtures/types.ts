import type { Field } from '@/lib/field';

/**
 * Submission domain types for the Greenline test fixture.
 *
 * Module 1 only declares the shape — the populated fixture (Greenline
 * Recycling Ltd, broker email + slip) lands in module 2 alongside the
 * intake / extraction flow.
 */

export type Address = {
  line1: string;
  line2?: string;
  town: string;
  postcode: string;
};

export type Site = {
  id: string;
  address: Field<Address>;
  wasteStreams: Field<string[]>;
  storageTonnage: Field<number>;
  hasFireSuppression: Field<boolean>;
};

export type Insured = {
  legalName: Field<string>;
  tradingName: Field<string>;
  companiesHouseNumber: Field<string>;
  yearsTrading: Field<number>;
  turnover: Field<number>;
};

export type Cover = {
  inceptionDate: Field<string>;
  expiryDate: Field<string>;
  publicLiabilityLimit: Field<number>;
  employersLiabilityLimit: Field<number>;
  environmentalImpairmentLimit: Field<number>;
};

export type Submission = {
  id: string;
  folio: string;
  receivedAt: string;
  broker: Field<string>;
  insured: Insured;
  cover: Cover;
  sites: Site[];
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
