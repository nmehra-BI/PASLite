/**
 * Module 9 — Manchester MTA fixture.
 *
 * The canonical mid-term adjustment for Greenline Recycling Ltd:
 * adding a 4th operating site (Manchester · Trafford Park) with
 * effect from 1 August 2026. Mirrors the broker email + survey
 * attachment that an MGA mailbox would receive.
 */

export type MtaChangeType =
  | 'add-site'
  | 'remove-site'
  | 'turnover-change'
  | 'coverage-change'
  | 'warranty-change'
  | 'permit-update'
  | 'multi-change';

export type MtaNewSite = {
  name: string;
  address: string;
  sqm: number;
  materials: string[];
  fireSuppression: 'present' | 'absent';
  permitStatus: 'pending' | 'in-force' | 'absent';
  expectedPermitRef?: string;
  expectedPermitBy?: string;
};

export type MtaRequest = {
  id: string;
  policyRef: string;
  effectiveDate: string;
  changeType: MtaChangeType;
  brokerName: string;
  brokerEmail: string;
  receivedAt: string;
  subject: string;
  emailBody: string;
  newSite: MtaNewSite;
  newTurnover: number;
  newSiteCount: number;
  brokerNote: string;
  sourceRef: string;
  attachments: string[];
  /** Confidence per extracted field (0–1). */
  confidences: Record<string, number>;
};

export const MANCHESTER_MTA: MtaRequest = {
  // The endorsement id is derived at runtime by receiveMtaRequest()
  // from policy state (priorEndorsementCount + versions.length + 1).
  // This sentinel is replaced before the request reaches any consumer;
  // the fixture intentionally describes substance only.
  id: '',
  policyRef: 'POL-29481',
  effectiveDate: '2026-08-01T00:00:00+01:00',
  changeType: 'add-site',
  brokerName: 'Sarah Whitfield',
  brokerEmail: 's.whitfield@surestep.co.uk',
  receivedAt: '2026-08-01T09:00:00+01:00',
  subject: 'MTA request — Greenline Recycling — POL-29481 — add Manchester',
  emailBody: `Hi Nishit,

Greenline have just signed a lease on a new operating site in Manchester (Trafford Park, M17 8AS). They'd like cover added to POL-29481 with effect from 1 August.

The new site is similar to the others — mixed dry recyclables, 4,200 sqm, 1 building, fire suppression present (sprinkler + smoke detection per the new install). EA permit pending — they expect EAWML-77890 by mid-September. They'll trade out of the new site as a 4th location.

Updated turnover projection: £10.1M for the remainder of the policy year (vs the £8.42M originally declared).

Please confirm what the additional premium would be. Survey report attached for the new site.

Best,
Sarah`,
  newSite: {
    name: 'Manchester',
    address: 'Trafford Park, M17 8AS',
    sqm: 4_200,
    materials: ['paper', 'cardboard', 'plastics (PET, HDPE)', 'metals (aluminium, steel)'],
    fireSuppression: 'present',
    permitStatus: 'pending',
    expectedPermitRef: 'EAWML-77890',
    expectedPermitBy: '2026-09-15',
  },
  newTurnover: 10_100_000,
  newSiteCount: 4,
  brokerNote:
    'Greenline have just signed a lease on a new operating site in Manchester (Trafford Park).',
  sourceRef: 'mta-email:001',
  attachments: ['manchester-survey.pdf', 'manchester-permit-application.pdf'],
  confidences: {
    effectiveDate: 0.99,
    changeType: 0.97,
    'newSite.name': 0.99,
    'newSite.address': 0.97,
    'newSite.sqm': 0.96,
    'newSite.materials': 0.93,
    'newSite.fireSuppression': 0.92,
    'newSite.permitStatus': 0.86,
    newTurnover: 0.91,
  },
};

export function getManchesterMtaRequest(): MtaRequest {
  // Defensive copy — caller may stamp dates / mutate fields as it wishes.
  return JSON.parse(JSON.stringify(MANCHESTER_MTA)) as MtaRequest;
}

/**
 * Stable extraction schedule for the cinematic. Each step maps a
 * field path on the MTA record to its display name; the engine
 * staggers their reveal at ~150ms.
 */
export type MtaExtractionStep = {
  fieldPath: string;
  label: string;
  /** dotted path on the request record (for evidence). */
  sourcePath: string;
};

export function getMtaExtractionSchedule(): MtaExtractionStep[] {
  return [
    { fieldPath: 'effectiveDate', label: 'Effective date', sourcePath: 'effectiveDate' },
    { fieldPath: 'changeType', label: 'Change type', sourcePath: 'changeType' },
    { fieldPath: 'newSite.name', label: 'New site', sourcePath: 'newSite.name' },
    { fieldPath: 'newSite.address', label: 'Address', sourcePath: 'newSite.address' },
    { fieldPath: 'newSite.sqm', label: 'Floor area', sourcePath: 'newSite.sqm' },
    { fieldPath: 'newSite.materials', label: 'Materials', sourcePath: 'newSite.materials' },
    { fieldPath: 'newSite.fireSuppression', label: 'Fire suppression', sourcePath: 'newSite.fireSuppression' },
    { fieldPath: 'newSite.permitStatus', label: 'Permit status', sourcePath: 'newSite.permitStatus' },
    { fieldPath: 'newTurnover', label: 'Updated turnover', sourcePath: 'newTurnover' },
  ];
}
