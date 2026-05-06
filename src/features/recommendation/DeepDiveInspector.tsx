import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useRanBerri } from '@/store';
import { lookupBinder, lookupCompetitor, lookupLoss } from './recommendation-engine';
import { SimilarBindersTable } from './SimilarBindersTable';
import { SimilarLossesTable } from './SimilarLossesTable';
import { CompetitiveIntelCard } from './CompetitiveIntelCard';

type Props = { onClose: () => void };

/**
 * The "why this recommendation?" deep dive. Six sections, mostly
 * reusing the smaller components elsewhere on the page. This is the
 * audit-replay surface for the recommendation: an auditor reading
 * the cockpit in 2027 can replay the exact recommendation that
 * informed the bind decision.
 */
export function DeepDiveInspector({ onClose }: Props) {
  const recommendation = useRanBerri((s) => s.recommendation);
  const binders = recommendation.similarBinderIds
    .map(lookupBinder)
    .filter(Boolean) as NonNullable<ReturnType<typeof lookupBinder>>[];
  const losses = recommendation.similarLossIds
    .map(lookupLoss)
    .filter(Boolean) as NonNullable<ReturnType<typeof lookupLoss>>[];
  const competitors = recommendation.competitorNames
    .map(lookupCompetitor)
    .filter(Boolean) as NonNullable<ReturnType<typeof lookupCompetitor>>[];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      role="dialog"
      aria-label="Recommendation deep dive"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 30, 29, 0.18)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
      }}
    >
      <motion.aside
        initial={{ x: 16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 16, opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="hairline-l"
        style={{
          width: 620,
          maxWidth: '100vw',
          background: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          className="hairline-b flex items-center justify-between"
          style={{ padding: '14px 22px', flex: '0 0 auto' }}
        >
          <div>
            <div className="eyebrow">recommendation · deep dive</div>
            <div
              className="serif"
              style={{
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: '-0.012em',
                marginTop: 2,
                color: 'var(--color-ink)',
              }}
            >
              Why we recommend{' '}
              <span style={{ color: 'var(--color-accent)' }}>
                {(recommendation.primary ?? '—').toUpperCase()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: 6, color: 'var(--color-ink-mute)' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
          {/* Section 1 — narrative */}
          <Section title="Headline narrative">
            <div
              className="serif"
              style={{
                fontSize: 14.5,
                lineHeight: 1.6,
                color: 'var(--color-ink-soft)',
                letterSpacing: '-0.005em',
              }}
            >
              {recommendation.headline ?? '—'}
            </div>
          </Section>

          {/* Section 2 — factors */}
          <Section title="Factor decomposition">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recommendation.factors.map((f) => (
                <div
                  key={f.id}
                  className="hairline"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-button)',
                    background: 'var(--color-bg)',
                  }}
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: 'var(--color-ink-mute)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {f.id}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--color-ink)',
                      }}
                    >
                      {f.label}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: 'var(--color-ink-mute)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {f.vote.toUpperCase()} · {f.weight}
                    </span>
                  </div>
                  <div
                    className="serif"
                    style={{
                      fontStyle: 'italic',
                      fontSize: 12.5,
                      color: 'var(--color-ink-mute)',
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {f.rationale}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Section 3 — similar binders */}
          <Section title={`Similar binders (top ${binders.length})`}>
            <SimilarBindersTable binders={binders} />
          </Section>

          {/* Section 4 — similar losses */}
          <Section title={`Similar losses (top ${losses.length})`}>
            <SimilarLossesTable losses={losses} />
          </Section>

          {/* Section 5 — competitive intel */}
          <Section title="Competitive intel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {competitors.map((c) => (
                <CompetitiveIntelCard key={c.name} profile={c} />
              ))}
            </div>
          </Section>

          {/* Section 6 — assumptions */}
          <Section title="Assumptions &amp; limitations">
            <ul
              className="serif"
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 12.5,
                color: 'var(--color-ink-mute)',
                lineHeight: 1.6,
              }}
            >
              <li>
                Recommendation based on {binders.length} similar binders surfaced from
                the MGA&rsquo;s W&amp;R Tier-2 book.
              </li>
              <li>
                Competitive intelligence drawn from 25 NTU records logged over the
                last 18 months. Coverage incomplete; broker-reported competitor
                prices are estimates.
              </li>
              <li>
                The historical performance signal applies to a market segment that
                may have shifted; consider current market conditions.
              </li>
            </ul>
          </Section>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </section>
  );
}
