import type { AtRiskPattern } from '@/lib/ledger';

/**
 * Module 15 — at-risk annotation row. Warn-bordered, italic-serif,
 * cites the specific pattern. Optional outbound link (e.g. to a
 * claim record) renders inline with the description.
 */
export function AtRiskAnnotation({ patterns }: { patterns: AtRiskPattern[] }) {
  if (patterns.length === 0) return null;
  return (
    <div
      style={{
        marginTop: 8,
        padding: '8px 10px',
        borderRadius: 'var(--radius-button)',
        background: 'var(--color-warn-bg)',
        borderLeft: '2px solid var(--color-warn)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-warn)',
          marginBottom: 4,
        }}
      >
        ⚠ at risk
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {patterns.map((p) => (
          <li
            key={p.pattern}
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-ink)',
              letterSpacing: '-0.005em',
              lineHeight: 1.55,
            }}
          >
            {p.description}
            {p.link && (
              <>
                {' '}
                <a
                  href={p.link.href}
                  className="serif"
                  style={{
                    fontStyle: 'italic',
                    color: 'var(--color-accent)',
                    textDecoration: 'none',
                    marginLeft: 4,
                  }}
                >
                  {p.link.label}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
