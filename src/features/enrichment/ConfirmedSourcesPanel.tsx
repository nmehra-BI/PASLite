import { Check } from 'lucide-react';
import { useRanBerri } from '@/store';
import { useIntake } from '@/features/intake';
import { ENRICHMENT_SOURCES } from '@/lib/fixtures';
import type {
  CompaniesHousePayload,
  EAPermitPayload,
  LossIndexPayload,
  SanctionsPayload,
} from '@/lib/fixtures';
import type { SourceStatus } from '@/store/replay';

/**
 * Quiet positive-verification panel. Sources that confirmed broker
 * data (or returned a clean / no-prior result) appear here as small
 * hairline rows. The point: the system is silently doing positive
 * verification, and the underwriter should see that even when there's
 * nothing to act on.
 *
 * Companies House appears here too &mdash; it's only the *turnover*
 * that conflicts; directors / status / address all confirm.
 */
export function ConfirmedSourcesPanel() {
  const sources = useRanBerri((s) => s.enrichment.sources);
  const open = useIntake((s) => s.openSourceInspector);

  const rows: Array<{
    id: string;
    label: string;
    summary: string;
    service: string;
    refreshedAt: string | null;
  }> = [];

  for (const meta of ENRICHMENT_SOURCES) {
    const status: SourceStatus | undefined = sources[meta.id];
    if (!status?.result) continue;
    rows.push(...derivedRows(meta.id, status));
  }

  if (rows.length === 0) return null;

  return (
    <section style={{ marginTop: 24 }}>
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 8 }}
      >
        <div className="eyebrow">confirmed · {rows.length}</div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {rows.map((row, i) => (
          <button
            key={row.id + ':' + i}
            type="button"
            onClick={() => open(rowSourceId(row.id))}
            className={i > 0 ? 'hairline-t' : ''}
            style={{
              display: 'grid',
              gridTemplateColumns: '20px 160px 1fr auto',
              gap: 14,
              alignItems: 'baseline',
              width: '100%',
              textAlign: 'left',
              padding: '10px 0',
              cursor: 'pointer',
            }}
          >
            <Check
              size={13}
              strokeWidth={1.75}
              style={{ color: 'var(--color-success)' }}
            />
            <span
              style={{
                fontSize: 13,
                color: 'var(--color-ink)',
                letterSpacing: '-0.005em',
              }}
            >
              {row.label}
            </span>
            <span
              className="serif"
              style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}
            >
              {row.summary}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--color-ink-faint)',
                letterSpacing: '0.06em',
              }}
            >
              {row.service} · {row.refreshedAt ? formatTime(row.refreshedAt) : 'just now'}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function rowSourceId(rowId: string): string {
  return rowId.split('::')[0]!;
}

function derivedRows(
  id: string,
  status: SourceStatus,
): Array<{
  id: string;
  label: string;
  summary: string;
  service: string;
  refreshedAt: string | null;
}> {
  const refreshedAt = status.returnedAt;
  if (id === 'ea-permit-registry') {
    const p = status.result?.payload as EAPermitPayload | undefined;
    if (!p) return [];
    return [
      {
        id: `${id}::permits`,
        label: 'EA permits',
        summary: `${p.permits.filter((x) => x.status === 'valid').length} of ${p.permits.length} valid`,
        service: 'permit-registry',
        refreshedAt,
      },
    ];
  }
  if (id === 'experian-sanctions') {
    const p = status.result?.payload as SanctionsPayload | undefined;
    if (!p) return [];
    return [
      {
        id: `${id}::sanctions`,
        label: 'Sanctions',
        summary: `clean across ${p.lists.length} lists`,
        service: 'experian',
        refreshedAt,
      },
    ];
  }
  if (id === 'internal-loss-index') {
    const p = status.result?.payload as LossIndexPayload | undefined;
    if (!p) return [];
    return [
      {
        id: `${id}::history`,
        label: 'Loss history',
        summary:
          p.priorSubmissions === 0
            ? 'no prior with this MGA'
            : `${p.priorSubmissions} prior submissions`,
        service: 'internal',
        refreshedAt,
      },
    ];
  }
  if (id === 'companies-house') {
    const p = status.result?.payload as CompaniesHousePayload | undefined;
    if (!p) return [];
    const activeDirs = p.directors.filter((d) => d.status === 'active').length;
    const disqualified = p.directors.filter((d) => d.status === 'disqualified').length;
    return [
      {
        id: `${id}::directors`,
        label: 'Directors',
        summary: `${activeDirs} active, ${disqualified === 0 ? 'none disqualified' : `${disqualified} disqualified`}`,
        service: 'companies-house',
        refreshedAt,
      },
    ];
  }
  return [];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
