/**
 * Mock external enrichment sources for the Greenline submission.
 *
 * Each source returns a typed payload after a realistic latency. The
 * Companies House FY24-vs-FY23 mismatch is the deliberate cross-source
 * conflict the resolution UI surfaces.
 */

export type EnrichmentSourceId =
  | 'companies-house'
  | 'ea-permit-registry'
  | 'experian-sanctions'
  | 'internal-loss-index';

export type SourceMeta = {
  id: EnrichmentSourceId;
  /** Display name in source cards. */
  name: string;
  /** Mono identifier appended to confirmation rows. */
  service: string;
  /** Realistic latency in ms before the mock returns. */
  latencyMs: number;
};

export const ENRICHMENT_SOURCES: SourceMeta[] = [
  {
    id: 'internal-loss-index',
    name: 'Internal Loss Index',
    service: 'internal',
    latencyMs: 200,
  },
  {
    id: 'experian-sanctions',
    name: 'Experian Sanctions',
    service: 'experian',
    latencyMs: 400,
  },
  {
    id: 'companies-house',
    name: 'Companies House',
    service: 'companies-house',
    latencyMs: 800,
  },
  {
    id: 'ea-permit-registry',
    name: 'EA Permit Registry',
    service: 'permit-registry',
    latencyMs: 1100,
  },
];

// ---------- payloads ----------

export type CompaniesHousePayload = {
  status: 'active' | 'dissolved' | 'liquidation';
  registeredOffice: string;
  dateOfIncorporation: string;
  directors: Array<{ name: string; role: string; status: 'active' | 'resigned' | 'disqualified' }>;
  latestFiling: {
    fyEnding: string;
    filedAt: string;
    turnover: number;
  };
};

export type EAPermitPayload = {
  permits: Array<{
    site: string;
    ref: string;
    validTo: string;
    status: 'valid' | 'lapsed';
  }>;
  unknownPermits: string[];
};

export type SanctionsPayload = {
  lists: Array<{ name: string; verdict: 'clean' | 'hit' | 'partial-match' }>;
  refreshedAt: string;
};

export type LossIndexPayload = {
  priorSubmissions: number;
  relatedEntities: Array<{ name: string; chn: string; claims: number }>;
  refreshedAt: string;
};

export type SourcePayload =
  | CompaniesHousePayload
  | EAPermitPayload
  | SanctionsPayload
  | LossIndexPayload;

export type SourceVerdict = 'confirmed' | 'conflict' | 'no-prior';

export type SourceResult = {
  id: EnrichmentSourceId;
  /** Free-text rendered on the source card after it returns. */
  summary: string;
  verdict: SourceVerdict;
  payload: SourcePayload;
  /** Refreshed-at timestamp (ISO). */
  refreshedAt: string;
};

// ---------- mock query functions ----------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function queryCompaniesHouse(
  refreshedAt: string,
): Promise<SourceResult> {
  await sleep(800);
  const payload: CompaniesHousePayload = {
    status: 'active',
    registeredOffice: 'Birmingham B30 3HX',
    dateOfIncorporation: '2010-11-04',
    directors: [
      { name: 'J. Greenline', role: 'director', status: 'active' },
      { name: 'M. Greenline', role: 'director', status: 'active' },
    ],
    latestFiling: {
      fyEnding: 'FY23',
      filedAt: '2025-03-31',
      turnover: 7_910_000,
    },
  };
  return {
    id: 'companies-house',
    summary: 'turnover £7.91M (filed FY23) — conflict with broker',
    verdict: 'conflict',
    payload,
    refreshedAt,
  };
}

export async function queryEAPermitRegistry(
  refreshedAt: string,
): Promise<SourceResult> {
  await sleep(1100);
  const payload: EAPermitPayload = {
    permits: [
      { site: 'Birmingham', ref: 'EAWML-88301', validTo: '2027-08-12', status: 'valid' },
      { site: 'Leeds', ref: 'EAWML-99214', validTo: '2026-07-01', status: 'valid' },
      { site: 'Glasgow', ref: 'EAWML-77450', validTo: '2028-09-04', status: 'valid' },
    ],
    unknownPermits: [],
  };
  return {
    id: 'ea-permit-registry',
    summary: '3 of 3 permits verified',
    verdict: 'confirmed',
    payload,
    refreshedAt,
  };
}

export async function queryExperianSanctions(
  refreshedAt: string,
): Promise<SourceResult> {
  await sleep(400);
  const payload: SanctionsPayload = {
    lists: [
      { name: 'UK Treasury', verdict: 'clean' },
      { name: 'OFAC', verdict: 'clean' },
      { name: 'EU Consolidated', verdict: 'clean' },
      { name: 'UN Sanctions', verdict: 'clean' },
    ],
    refreshedAt,
  };
  return {
    id: 'experian-sanctions',
    summary: 'clean across 4 lists',
    verdict: 'confirmed',
    payload,
    refreshedAt,
  };
}

export async function queryInternalLossIndex(
  refreshedAt: string,
): Promise<SourceResult> {
  await sleep(200);
  const payload: LossIndexPayload = {
    priorSubmissions: 0,
    relatedEntities: [
      { name: 'Greenline Holdings Ltd', chn: '07442199', claims: 0 },
    ],
    refreshedAt,
  };
  return {
    id: 'internal-loss-index',
    summary: 'no prior with this MGA',
    verdict: 'no-prior',
    payload,
    refreshedAt,
  };
}

export const SOURCE_QUERIES: Record<
  EnrichmentSourceId,
  (refreshedAt: string) => Promise<SourceResult>
> = {
  'companies-house': queryCompaniesHouse,
  'ea-permit-registry': queryEAPermitRegistry,
  'experian-sanctions': queryExperianSanctions,
  'internal-loss-index': queryInternalLossIndex,
};
