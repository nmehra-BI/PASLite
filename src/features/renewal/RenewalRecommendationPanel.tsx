import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useRanBerri } from '@/store';
import {
  buildRenewalRecommendation,
  type RenewalRecommendation,
  type RenewalRecommendationFactor,
} from '@/lib/renewal';

const SHARP_COMPETITOR_HOLD_FLOOR = 50_500;

/**
 * Renewal recommendation panel — 7-factor evaluation card.
 *
 * The audit log captures factorIds, primary, confidence, and the
 * headline; for the editorial render we recompute the full factor
 * records locally (pure function, same inputs the engine used).
 *
 * The cinematic: factors stagger in over ~3s, the headline streams
 * word-by-word over ~1.5s.
 */
export function RenewalRecommendationPanel() {
  const renewal = useRanBerri((s) => s.renewal);

  const recommendation = useMemo<RenewalRecommendation | null>(() => {
    if (
      !renewal.year1Review ||
      !renewal.selectedOption ||
      renewal.year2.technicalPremium === null
    ) {
      return null;
    }
    return buildRenewalRecommendation({
      year1Review: renewal.year1Review,
      year2TechnicalPremium: renewal.year2.technicalPremium,
      selectedDefencePremium: renewal.selectedOption.premium,
      sharpCompetitorHoldFloor: SHARP_COMPETITOR_HOLD_FLOOR,
      brokerTargetPremium: renewal.insuredChanges.brokerTargetPremium,
      brokerSentiment: renewal.year1Review.brokerRelationship.sentiment,
      materialAdditions: renewal.insuredChanges.materialAdditions,
    });
  }, [
    renewal.year1Review,
    renewal.selectedOption,
    renewal.year2.technicalPremium,
    renewal.insuredChanges.brokerTargetPremium,
    renewal.insuredChanges.materialAdditions,
  ]);

  const ready =
    renewal.phase === 'recommendation-ready' ||
    renewal.phase === 'slip-ready' ||
    renewal.phase === 'ceremony-in-progress' ||
    renewal.phase === 'committed' ||
    renewal.phase === 'sent';

  if (!ready || !recommendation || !renewal.recommendation.headline) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="hairline-t"
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow inline-flex items-center" style={{ gap: 6 }}>
          <Sparkles size={11} strokeWidth={1.5} />
          renewal recommendation · 7 factors
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 14.5,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          year-1 performance dominates · profile match deweighted (the policy IS the ground truth)
        </div>
      </header>

      <Headline text={renewal.recommendation.headline} />

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {recommendation.factors.map((f, i) => (
          <FactorRow key={f.id} factor={f} delayMs={i * 280} />
        ))}
      </div>

      <Verdict
        primary={renewal.recommendation.primary}
        confidence={renewal.recommendation.confidence}
      />
    </motion.section>
  );
}

function Headline({ text }: { text: string }) {
  const words = text.split(/(\s+)/);
  return (
    <p
      className="serif"
      style={{
        fontSize: 16,
        color: 'var(--color-ink)',
        lineHeight: 1.5,
        margin: 0,
        letterSpacing: '-0.005em',
      }}
    >
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <span key={i}>{w}</span>
        ) : (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, delay: 0.02 * i }}
            style={{ display: 'inline' }}
          >
            {w}
          </motion.span>
        ),
      )}
    </p>
  );
}

function FactorRow({
  factor,
  delayMs,
}: {
  factor: RenewalRecommendationFactor;
  delayMs: number;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  const tone =
    factor.vote === 'pro-bind'
      ? 'var(--color-success)'
      : factor.vote === 'pro-refer'
        ? 'var(--color-warn)'
        : factor.vote === 'pro-ntu'
          ? 'var(--color-danger)'
          : 'var(--color-ink-mute)';
  const glyph =
    factor.vote === 'pro-bind' ? '+' : factor.vote === 'neutral' ? '·' : '−';
  const isNew = factor.id === 'FCT-006' || factor.id === 'FCT-007';

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="hairline"
          style={{
            borderRadius: 'var(--radius-card)',
            padding: '10px 14px',
            background: isNew ? 'rgba(201, 99, 66, 0.04)' : 'var(--color-surface)',
            borderColor: isNew ? 'var(--color-accent)' : 'var(--color-rule-mid)',
            display: 'grid',
            gridTemplateColumns: '20px 1fr auto',
            gap: 10,
            alignItems: 'baseline',
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 14,
              color: tone,
              letterSpacing: '0.04em',
              textAlign: 'center',
              fontWeight: 500,
            }}
            aria-hidden
          >
            {glyph}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="flex items-baseline gap-2">
              <span
                className="mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-faint)',
                }}
              >
                {factor.id}
              </span>
              <span
                className="serif"
                style={{
                  fontSize: 13.5,
                  color: 'var(--color-ink)',
                  letterSpacing: '-0.005em',
                }}
              >
                {factor.label}
              </span>
              {isNew && (
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--color-accent)',
                  }}
                >
                  renewal-specific
                </span>
              )}
            </div>
            <div
              className="serif"
              style={{
                fontStyle: 'italic',
                fontSize: 12.5,
                color: 'var(--color-ink-mute)',
                marginTop: 3,
                lineHeight: 1.55,
                letterSpacing: '-0.005em',
              }}
            >
              {factor.rationale}
            </div>
          </div>
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color:
                factor.weight === 'high'
                  ? 'var(--color-accent)'
                  : factor.weight === 'moderate'
                    ? 'var(--color-ink-soft)'
                    : 'var(--color-ink-faint)',
            }}
          >
            {factor.weight}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Verdict({
  primary,
  confidence,
}: {
  primary: 'bind' | 'refer' | 'ntu' | null;
  confidence: 'high' | 'moderate' | 'low' | null;
}) {
  if (!primary || !confidence) return null;
  const label = primary === 'bind' ? 'BIND (renew)' : primary === 'refer' ? 'REFER' : 'NTU';
  const tone =
    primary === 'bind'
      ? 'var(--color-success)'
      : primary === 'refer'
        ? 'var(--color-warn)'
        : 'var(--color-danger)';
  return (
    <div
      className="hairline-t"
      style={{
        marginTop: 16,
        paddingTop: 12,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
        }}
      >
        verdict
      </div>
      <div
        className="serif"
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: tone,
          letterSpacing: '-0.005em',
        }}
      >
        {label}{' '}
        <span
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.1em',
            color: 'var(--color-ink-mute)',
            marginLeft: 6,
            textTransform: 'uppercase',
            fontWeight: 400,
          }}
        >
          {confidence} confidence
        </span>
      </div>
    </div>
  );
}

