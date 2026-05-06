import { z } from 'zod';
import { createField, extractField } from '@/lib/field';
import type { Submission, LossRun } from './types';

/**
 * Greenline Recycling Ltd — the canonical submission fixture used
 * across modules 2-6. Module 2 produces the populated Submission via
 * the cinematic extraction sequence; downstream modules consume it as-is.
 */

const MODEL_VERSION = 'sonnet-4-7';
const RECEIVED_AT = '2026-05-09T08:14:00Z'; // 09:14 BST in UTC
const EXTRACTION_AT = '2026-05-09T08:14:38Z';

// ---------- broker email ----------

export type BrokerEmail = {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  attachments: Array<{ filename: string; pages?: number; description: string }>;
};

export const GREENLINE_EMAIL: BrokerEmail = {
  from: 's.whitfield@surestep.co.uk',
  fromName: 'Sarah Whitfield',
  to: 'submissions@ranberri.uk',
  subject: 'New business — Greenline Recycling Ltd — UK W&R',
  date: '2026-05-09T09:14:00+01:00',
  body: `Hi team,

Please find attached a new business submission for Greenline Recycling Ltd, a UK waste & recycling operator. Inception requested 15 May. Three sites: Birmingham (HQ), Leeds and Glasgow. Mixed dry recyclables — paper, plastic, metals. Annual turnover c. £8.4M (FY24 filed accounts).

Loss runs attached for last 5 years. One material loss in 2023 (fire at Birmingham, £180k paid). Otherwise low frequency, low severity.

Insured is keen to bind by inception date. Happy to discuss terms — broker target premium ~£45k.

Best,
Sarah`,
  attachments: [
    { filename: 'greenline-acord.pdf', pages: 4, description: 'risk submission slip' },
    { filename: 'greenline-lossruns.pdf', pages: 5, description: '5-year loss runs' },
    { filename: 'ea-permit-leeds.pdf', description: 'EA permit — Leeds' },
    { filename: 'ea-permit-birmingham.pdf', description: 'EA permit — Birmingham' },
    { filename: 'ea-permit-glasgow.pdf', description: 'EA permit — Glasgow' },
  ],
};

// ---------- slip pages (rendered on the left during extraction) ----------

export type SlipLine = { line: number; text: string; emphasis?: boolean };
export type SlipPage = {
  page: number;
  heading: string;
  lines: SlipLine[];
};

export const GREENLINE_SLIP: SlipPage[] = [
  {
    page: 1,
    heading: 'ACORD risk submission · cover page',
    lines: [
      { line: 1, text: 'Submission ref: SS/2026/05/0942' },
      { line: 2, text: 'Class: Combined liability — UK waste & recycling' },
      { line: 3, text: 'Producing broker: SureStep Brokers Ltd' },
      { line: 4, text: 'Producing handler: Sarah Whitfield' },
      { line: 5, text: 'Date prepared: 9 May 2026' },
      { line: 6, text: '—' },
      { line: 7, text: 'Capacity sought: A-rated, Lloyd’s syndicate or admitted MGA' },
      { line: 8, text: 'Limits requested: as schedule, page 4' },
    ],
  },
  {
    page: 2,
    heading: 'Insured particulars',
    lines: [
      { line: 9, text: 'Section 1 — Insured' },
      { line: 10, text: '—' },
      { line: 11, text: 'Trading style: Greenline' },
      { line: 12, text: 'Insured: Greenline Recycling Ltd', emphasis: true },
      { line: 13, text: 'Companies House: 07442198', emphasis: true },
      { line: 14, text: 'Annual turnover (FY24): £8,420,000', emphasis: true },
      { line: 15, text: 'Annual turnover (FY23): £7,910,000', emphasis: true },
      { line: 16, text: 'Trading address: Birmingham (HQ)' },
      { line: 17, text: 'Years trading: 12' },
    ],
  },
  {
    page: 3,
    heading: 'Schedule A — Operating sites',
    lines: [
      { line: 18, text: 'i.   Birmingham (HQ)  ·  2,800 sqm  ·  permit valid', emphasis: true },
      { line: 19, text: '     EA permit ref: EAWML-88301  ·  expires 12 Aug 2027' },
      { line: 20, text: 'ii.  Leeds  ·  3,400 sqm  ·  permit valid', emphasis: true },
      { line: 21, text: '     EA permit ref: EAWML-99214  ·  expires 1 Jul 2026' },
      { line: 22, text: 'iii. Glasgow  ·  2,100 sqm  ·  permit valid', emphasis: true },
      { line: 23, text: '     EA permit ref: EAWML-77450  ·  expires 4 Sep 2028' },
    ],
  },
  {
    page: 4,
    heading: 'Section 2 — Cover & operations',
    lines: [
      { line: 24, text: 'Materials handled: mixed dry recyclables —', emphasis: true },
      { line: 25, text: '   paper, cardboard, plastics (PET, HDPE), metals (aluminium, steel)' },
      { line: 26, text: 'Fire suppression: NOT DISCLOSED', emphasis: true },
      { line: 27, text: 'Storage: bay-segregated' },
      { line: 28, text: 'Inception requested: 15 May 2026, 12:00 BST', emphasis: true },
      { line: 29, text: 'Term: 12 months', emphasis: true },
      { line: 30, text: '—' },
      { line: 31, text: 'Loss runs: see attached, 5 years', emphasis: true },
      { line: 32, text: 'Stated loss ratio: 38%', emphasis: true },
      { line: 33, text: 'Broker target premium: £45,000 indicative', emphasis: true },
    ],
  },
];

// ---------- the populated Submission ----------

const GREENLINE_LOSS_RUNS: LossRun[] = [
  { year: 2020, type: 'slips and trips', amount: 8_400, status: 'paid' },
  { year: 2021, type: 'property damage', amount: 14_200, status: 'paid' },
  { year: 2022, type: 'vehicle accident', amount: 6_800, status: 'paid' },
  { year: 2023, type: 'fire (Birmingham)', amount: 180_000, status: 'paid', note: 'material loss' },
  { year: 2024, type: 'slips and trips', amount: 4_200, status: 'paid' },
];

const GREENLINE_MATERIALS = [
  'paper',
  'cardboard',
  'plastics (PET, HDPE)',
  'metals (aluminium, steel)',
];

/**
 * Build the populated Submission, with both `brokerStated` and
 * `systemExtracted` layers filled. `underwriterCorrected` stays null
 * &mdash; corrections only land via `applyCorrection` from the
 * inspector.
 */
export function getGreenlineSubmission(): Submission {
  const ext = <T,>(brokerValue: T, value: T, sourceRef: string, confidence: number) =>
    extractField(createField<T>(brokerValue), {
      value,
      confidence,
      sourceRef,
      extractedAt: EXTRACTION_AT,
      modelVersion: MODEL_VERSION,
    });

  // Field where the broker did not state a value but the AI inferred one
  // (the fire-suppression gap). brokerStated stays null.
  const inferredGap = <T,>(value: T, sourceRef: string, confidence: number) =>
    extractField(createField<T>(null), {
      value,
      confidence,
      sourceRef,
      extractedAt: EXTRACTION_AT,
      modelVersion: MODEL_VERSION,
    });

  return {
    id: 'sub_greenline_2026_05',
    folio: 'MGA-PAS · folio 29481',
    receivedAt: RECEIVED_AT,
    broker: ext('SureStep Brokers Ltd', 'SureStep Brokers Ltd', 'email:from', 0.99),

    insured: {
      legalName: ext('Greenline Recycling Ltd', 'Greenline Recycling Ltd', 'slip:p2:l12', 0.99),
      tradingName: ext('Greenline', 'Greenline', 'slip:p2:l11', 0.97),
      companiesHouseNumber: ext('07442198', '07442198', 'slip:p2:l13', 0.98),
      yearsTrading: ext(12, 12, 'slip:p2:l17', 0.95),
      turnover: ext(8_420_000, 8_420_000, 'slip:p2:l14', 0.96),
      turnoverPrior: ext(7_910_000, 7_910_000, 'slip:p2:l15', 0.96),
    },

    cover: {
      inceptionDate: ext('2026-05-15T11:00:00Z', '2026-05-15T11:00:00Z', 'slip:p4:l28', 0.97),
      expiryDate: ext('2027-05-15T11:00:00Z', '2027-05-15T11:00:00Z', 'slip:p4:l29', 0.96),
      term: ext('12 months', '12 months', 'slip:p4:l29', 0.99),
      publicLiabilityLimit: ext(5_000_000, 5_000_000, 'slip:p1:l8', 0.9),
      employersLiabilityLimit: ext(10_000_000, 10_000_000, 'slip:p1:l8', 0.9),
      environmentalImpairmentLimit: ext(2_000_000, 2_000_000, 'slip:p1:l8', 0.9),
    },

    sites: [
      {
        id: 'site_birmingham',
        name: ext('Birmingham (HQ)', 'Birmingham (HQ)', 'slip:p3:l18', 0.94),
        sqm: ext(2_800, 2_800, 'slip:p3:l18', 0.94),
        permitRef: ext('EAWML-88301', 'EAWML-88301', 'slip:p3:l19', 0.96),
        permitExpiry: ext('2027-08-12', '2027-08-12', 'slip:p3:l19', 0.95),
      },
      {
        id: 'site_leeds',
        name: ext('Leeds', 'Leeds', 'slip:p3:l20', 0.94),
        sqm: ext(3_400, 3_400, 'slip:p3:l20', 0.94),
        permitRef: ext('EAWML-99214', 'EAWML-99214', 'slip:p3:l21', 0.96),
        permitExpiry: ext('2026-07-01', '2026-07-01', 'slip:p3:l21', 0.95),
      },
      {
        id: 'site_glasgow',
        name: ext('Glasgow', 'Glasgow', 'slip:p3:l22', 0.94),
        sqm: ext(2_100, 2_100, 'slip:p3:l22', 0.94),
        permitRef: ext('EAWML-77450', 'EAWML-77450', 'slip:p3:l23', 0.96),
        permitExpiry: ext('2028-09-04', '2028-09-04', 'slip:p3:l23', 0.95),
      },
    ],

    materials: ext(GREENLINE_MATERIALS, GREENLINE_MATERIALS, 'slip:p4:l24', 0.92),
    fireSuppressionDisclosed: inferredGap(false, 'slip:p4:l26', 0.88),
    lossRuns: ext(GREENLINE_LOSS_RUNS, GREENLINE_LOSS_RUNS, 'lossruns:p1', 0.95),
    statedLossRatio: ext(0.38, 0.38, 'lossruns:summary', 0.93),
    brokerTargetPremium: ext(45_000, 45_000, 'email:body', 0.85),
  };
}

// ---------- extraction schedule ----------

export type ExtractionStep = {
  /** Logical key shown in audit events. */
  key: string;
  /** Path into the Submission tree (for inspector + dep graph). */
  fieldPath: string;
  /** Display label rendered in the editorial extracted view group. */
  groupKey: ExtractionGroup;
  /** Pretty label shown next to the value in the extracted view. */
  label?: string;
  /** Source citation (e.g. slip:p2:l14). */
  sourceRef: string;
  /** Confidence the AI reports for this field. */
  confidence: number;
  /** Delay (ms) before this field is revealed during extraction. */
  delayMs: number;
  /** Pulses warn briefly when revealed (used for the gap). */
  pulseGap?: boolean;
};

export type ExtractionGroup =
  | 'insured'
  | 'turnover'
  | 'sites'
  | 'materials'
  | 'coverage'
  | 'lossHistory'
  | 'brokerTarget';

/**
 * The cinematic timing. Total extraction window ~2.4s after the
 * "reading" phase; the orchestrator wraps that in receiving + reading
 * for a total of ~4s.
 */
export function getExtractionSchedule(): ExtractionStep[] {
  let t = 0;
  const stagger = 150;

  const step = (over: Omit<ExtractionStep, 'delayMs'>): ExtractionStep => {
    t += stagger;
    return { ...over, delayMs: t };
  };

  return [
    step({
      key: 'insured.legalName',
      fieldPath: 'insured.legalName',
      groupKey: 'insured',
      label: 'Legal name',
      sourceRef: 'slip:p2:l12',
      confidence: 0.99,
    }),
    step({
      key: 'insured.companiesHouseNumber',
      fieldPath: 'insured.companiesHouseNumber',
      groupKey: 'insured',
      label: 'Companies House',
      sourceRef: 'slip:p2:l13',
      confidence: 0.98,
    }),
    step({
      key: 'insured.turnover',
      fieldPath: 'insured.turnover',
      groupKey: 'turnover',
      label: 'FY24',
      sourceRef: 'slip:p2:l14',
      confidence: 0.96,
    }),
    step({
      key: 'insured.turnoverPrior',
      fieldPath: 'insured.turnoverPrior',
      groupKey: 'turnover',
      label: 'FY23',
      sourceRef: 'slip:p2:l15',
      confidence: 0.96,
    }),
    step({
      key: 'sites',
      fieldPath: 'sites',
      groupKey: 'sites',
      sourceRef: 'slip:p3',
      confidence: 0.94,
    }),
    step({
      key: 'materials',
      fieldPath: 'materials',
      groupKey: 'materials',
      sourceRef: 'slip:p4:l24',
      confidence: 0.92,
    }),
    step({
      key: 'cover.inceptionDate',
      fieldPath: 'cover.inceptionDate',
      groupKey: 'coverage',
      label: 'Inception',
      sourceRef: 'slip:p4:l28',
      confidence: 0.97,
    }),
    step({
      key: 'cover.term',
      fieldPath: 'cover.term',
      groupKey: 'coverage',
      label: 'Term',
      sourceRef: 'slip:p4:l29',
      confidence: 0.99,
    }),
    step({
      key: 'lossRuns',
      fieldPath: 'lossRuns',
      groupKey: 'lossHistory',
      sourceRef: 'lossruns:p1',
      confidence: 0.95,
    }),
    step({
      key: 'statedLossRatio',
      fieldPath: 'statedLossRatio',
      groupKey: 'lossHistory',
      label: 'Stated loss ratio',
      sourceRef: 'lossruns:summary',
      confidence: 0.93,
    }),
    step({
      key: 'fireSuppressionDisclosed',
      fieldPath: 'fireSuppressionDisclosed',
      groupKey: 'coverage',
      label: 'Fire suppression',
      sourceRef: 'slip:p4:l26',
      confidence: 0.88,
      pulseGap: true,
    }),
    step({
      key: 'brokerTargetPremium',
      fieldPath: 'brokerTargetPremium',
      groupKey: 'brokerTarget',
      label: 'Broker target',
      sourceRef: 'email:body',
      confidence: 0.85,
    }),
  ];
}

// ---------- Zod schema (boundary validation) ----------

export const FieldSchema = z.object({
  brokerStated: z.unknown(),
  systemExtracted: z
    .object({
      value: z.unknown(),
      confidence: z.number().min(0).max(1),
      sourceRef: z.string(),
      extractedAt: z.string(),
      modelVersion: z.string(),
    })
    .nullable(),
  underwriterCorrected: z
    .object({
      value: z.unknown(),
      reason: z.string().min(1),
      correctedBy: z.string(),
      correctedAt: z.string(),
    })
    .nullable(),
});

export const ExtractedSubmissionSchema = z.object({
  id: z.string(),
  folio: z.string(),
  receivedAt: z.string(),
  broker: FieldSchema,
  insured: z.object({
    legalName: FieldSchema,
    tradingName: FieldSchema,
    companiesHouseNumber: FieldSchema,
    yearsTrading: FieldSchema,
    turnover: FieldSchema,
    turnoverPrior: FieldSchema,
  }),
  cover: z.object({
    inceptionDate: FieldSchema,
    expiryDate: FieldSchema,
    publicLiabilityLimit: FieldSchema,
    employersLiabilityLimit: FieldSchema,
    environmentalImpairmentLimit: FieldSchema,
    term: FieldSchema,
  }),
  sites: z.array(
    z.object({
      id: z.string(),
      name: FieldSchema,
      sqm: FieldSchema,
      permitRef: FieldSchema,
      permitExpiry: FieldSchema,
    }),
  ),
  materials: FieldSchema,
  fireSuppressionDisclosed: FieldSchema,
  lossRuns: FieldSchema,
  statedLossRatio: FieldSchema,
  brokerTargetPremium: FieldSchema,
});
