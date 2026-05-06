import { z } from 'zod';
import { createField } from '@/lib/field';
import { applyExtraction } from '@/store/replay';
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

// ---------- the broker-stated layer ----------

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
 * The Submission shell at the moment the email arrives — broker layer
 * populated, system + underwriter layers null. The cinematic
 * extraction then emits one `extraction.fieldExtracted` event per
 * field, each carrying the value the AI parses from the slip; replay
 * lifts those into `systemExtracted`.
 *
 * The fire-suppression field is a deliberate gap: the broker stated
 * nothing (brokerStated stays null on that Field). The AI's inferred
 * value lands via the extraction event with confidence 0.88.
 */
export function getGreenlineBrokerSubmission(): Submission {
  return {
    id: 'sub_greenline_2026_05',
    folio: 'MGA-PAS · folio 29481',
    receivedAt: RECEIVED_AT,
    broker: createField('SureStep Brokers Ltd'),

    insured: {
      legalName: createField('Greenline Recycling Ltd'),
      tradingName: createField('Greenline'),
      companiesHouseNumber: createField('07442198'),
      yearsTrading: createField(12),
      turnover: createField(8_420_000),
      turnoverPrior: createField(7_910_000),
    },

    cover: {
      inceptionDate: createField('2026-05-15T11:00:00Z'),
      expiryDate: createField('2027-05-15T11:00:00Z'),
      term: createField('12 months'),
      publicLiabilityLimit: createField(5_000_000),
      employersLiabilityLimit: createField(10_000_000),
      environmentalImpairmentLimit: createField(2_000_000),
    },

    sites: [
      {
        id: 'site_birmingham',
        name: createField('Birmingham (HQ)'),
        sqm: createField(2_800),
        permitRef: createField('EAWML-88301'),
        permitExpiry: createField('2027-08-12'),
      },
      {
        id: 'site_leeds',
        name: createField('Leeds'),
        sqm: createField(3_400),
        permitRef: createField('EAWML-99214'),
        permitExpiry: createField('2026-07-01'),
      },
      {
        id: 'site_glasgow',
        name: createField('Glasgow'),
        sqm: createField(2_100),
        permitRef: createField('EAWML-77450'),
        permitExpiry: createField('2028-09-04'),
      },
    ],

    materials: createField<string[]>(GREENLINE_MATERIALS),
    // Broker stated nothing about fire suppression — this is the gap.
    fireSuppressionDisclosed: createField<boolean>(null),
    lossRuns: createField<LossRun[]>(GREENLINE_LOSS_RUNS),
    statedLossRatio: createField(0.38),
    brokerTargetPremium: createField(45_000),
  };
}

/**
 * Convenience: the **fully-populated** Submission, broker + system
 * layers filled. Used by tests and by any direct-snapshot callers;
 * callers that drive the demo through the audit log do NOT use this
 * (they emit events and let `replay()` materialise state).
 */
export function getGreenlineSubmission(): Submission {
  const sub = getGreenlineBrokerSubmission();
  for (const step of getExtractionSchedule()) {
    applyExtraction(sub, step.fieldPath, step.value, {
      confidence: step.confidence,
      sourceRef: step.sourceRef,
      extractedAt: EXTRACTION_AT,
      modelVersion: MODEL_VERSION,
    });
  }
  return sub;
}

// ---------- extraction schedule ----------

export type ExtractionStep = {
  /** Logical key shown in audit events. */
  key: string;
  /** Path into the Submission tree (for inspector + dep graph). */
  fieldPath: string;
  /** The value the AI returns for this field. */
  value: unknown;
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

const SITES_EXTRACTED = [
  {
    name: 'Birmingham (HQ)',
    sqm: 2_800,
    permitRef: 'EAWML-88301',
    permitExpiry: '2027-08-12',
  },
  {
    name: 'Leeds',
    sqm: 3_400,
    permitRef: 'EAWML-99214',
    permitExpiry: '2026-07-01',
  },
  {
    name: 'Glasgow',
    sqm: 2_100,
    permitRef: 'EAWML-77450',
    permitExpiry: '2028-09-04',
  },
];

/**
 * The cinematic timing. ~150ms stagger × 12 fields ≈ 1.8s of
 * extraction; the orchestrator wraps that in receiving + reading for a
 * total of ~4s.
 *
 * `sites` and `lossRuns` are aggregate steps: the value is the whole
 * record array, and replay's `applyExtraction` walks into the structure
 * to set systemExtracted on each child Field<T>.
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
      value: 'Greenline Recycling Ltd',
      groupKey: 'insured',
      label: 'Legal name',
      sourceRef: 'slip:p2:l12',
      confidence: 0.99,
    }),
    step({
      key: 'insured.companiesHouseNumber',
      fieldPath: 'insured.companiesHouseNumber',
      value: '07442198',
      groupKey: 'insured',
      label: 'Companies House',
      sourceRef: 'slip:p2:l13',
      confidence: 0.98,
    }),
    step({
      key: 'insured.turnover',
      fieldPath: 'insured.turnover',
      value: 8_420_000,
      groupKey: 'turnover',
      label: 'FY24',
      sourceRef: 'slip:p2:l14',
      confidence: 0.96,
    }),
    step({
      key: 'insured.turnoverPrior',
      fieldPath: 'insured.turnoverPrior',
      value: 7_910_000,
      groupKey: 'turnover',
      label: 'FY23',
      sourceRef: 'slip:p2:l15',
      confidence: 0.96,
    }),
    step({
      key: 'sites',
      fieldPath: 'sites',
      value: SITES_EXTRACTED,
      groupKey: 'sites',
      sourceRef: 'slip:p3',
      confidence: 0.94,
    }),
    step({
      key: 'materials',
      fieldPath: 'materials',
      value: GREENLINE_MATERIALS,
      groupKey: 'materials',
      sourceRef: 'slip:p4:l24',
      confidence: 0.92,
    }),
    step({
      key: 'cover.inceptionDate',
      fieldPath: 'cover.inceptionDate',
      value: '2026-05-15T11:00:00Z',
      groupKey: 'coverage',
      label: 'Inception',
      sourceRef: 'slip:p4:l28',
      confidence: 0.97,
    }),
    step({
      key: 'cover.term',
      fieldPath: 'cover.term',
      value: '12 months',
      groupKey: 'coverage',
      label: 'Term',
      sourceRef: 'slip:p4:l29',
      confidence: 0.99,
    }),
    step({
      key: 'lossRuns',
      fieldPath: 'lossRuns',
      value: GREENLINE_LOSS_RUNS,
      groupKey: 'lossHistory',
      sourceRef: 'lossruns:p1',
      confidence: 0.95,
    }),
    step({
      key: 'statedLossRatio',
      fieldPath: 'statedLossRatio',
      value: 0.38,
      groupKey: 'lossHistory',
      label: 'Stated loss ratio',
      sourceRef: 'lossruns:summary',
      confidence: 0.93,
    }),
    step({
      key: 'fireSuppressionDisclosed',
      fieldPath: 'fireSuppressionDisclosed',
      value: false,
      groupKey: 'coverage',
      label: 'Fire suppression',
      sourceRef: 'slip:p4:l26',
      confidence: 0.88,
      pulseGap: true,
    }),
    step({
      key: 'brokerTargetPremium',
      fieldPath: 'brokerTargetPremium',
      value: 45_000,
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
