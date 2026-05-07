import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useRanBerri } from '@/store';
import {
  buildRecommendation,
  generateRenewalSlip,
  priceDefence,
  selectOption,
} from '@/lib/renewal';
import type { DefencePricingOption } from '@/lib/renewal';

const GBP = (n: number) => `£${n.toLocaleString('en-GB')}`;

/**
 * Defence pricing panel — the moat moment. Three-option card with
 * the recommended one highlighted in coral; selection fires the
 * orchestrator action and chains into recommendation + slip.
 *
 * priceDefence runs once when the panel renders for the first time
 * after year-2 rating. The orchestrator emits the audit event and
 * the store applies it; subsequent renders read renewal.defencePricing.
 */
export function DefencePricingPanel() {
  const renewal = useRanBerri((s) => s.renewal);
  const [pricing, setPricing] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Phase gate: only render once year-2 has been rated.
  if (
    renewal.phase === 'idle' ||
    renewal.phase === 'triggered' ||
    renewal.phase === 'year1-review' ||
    renewal.phase === 'changes-captured'
  ) {
    return null;
  }

  const options = renewal.defencePricing.options;
  const holdFloor = renewal.defencePricing.holdFloor;
  const hasOptions = options.length > 0;

  async function onPrice() {
    if (pricing || hasOptions) return;
    setPricing(true);
    try {
      priceDefence();
    } finally {
      setPricing(false);
    }
  }

  async function onSelect(o: DefencePricingOption) {
    if (selecting) return;
    setSelecting(o.id);
    try {
      selectOption({ optionId: o.id, selectedBy: 'nm' });
      // Build the recommendation + slip immediately so the workflow
      // continues into the slip panel without an extra click. This
      // mirrors how the bind path moves from quote → recommendation.
      await new Promise((r) => setTimeout(r, 220));
      buildRecommendation();
      await new Promise((r) => setTimeout(r, 220));
      generateRenewalSlip();
    } finally {
      setSelecting(null);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="hairline-t"
      style={{ padding: '22px 28px' }}
    >
      <header style={{ marginBottom: 14 }}>
        <div className="eyebrow">defence pricing · three prices in play</div>
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
          technical, defended, aggressive — pick the position to take
        </div>
      </header>

      {!hasOptions && (
        <button
          type="button"
          onClick={onPrice}
          disabled={pricing}
          className="inline-flex items-center"
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-button)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--color-bg)',
            background: pricing ? 'var(--color-ink-faint)' : 'var(--color-accent)',
            border: '0.5px solid var(--color-accent)',
            cursor: pricing ? 'wait' : 'pointer',
          }}
        >
          {pricing ? 'Pricing…' : 'Compute defence pricing →'}
        </button>
      )}

      {hasOptions && (
        <>
          {/* THREE PRICES IN PLAY summary band */}
          <PricesInPlay
            technical={renewal.year2.technicalPremium ?? 0}
            sharpFloor={holdFloor ?? 0}
            brokerTarget={renewal.insuredChanges.brokerTargetPremium}
          />

          {renewal.insuredChanges.competitivePressure && (
            <CompetitiveContext text={renewal.insuredChanges.competitivePressure} />
          )}

          <div
            style={{
              marginTop: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {options.map((o) => (
              <OptionCard
                key={o.id}
                option={o}
                selected={renewal.selectedOption?.id === o.id}
                disabled={selecting !== null}
                isLoading={selecting === o.id}
                onSelect={() => onSelect(o)}
              />
            ))}
          </div>

          <TheGold
            sharpFloor={holdFloor ?? 0}
            recommended={options.find((o) => o.recommended)}
          />
        </>
      )}
    </motion.section>
  );
}

function PricesInPlay({
  technical,
  sharpFloor,
  brokerTarget,
}: {
  technical: number;
  sharpFloor: number;
  brokerTarget: number | null;
}) {
  return (
    <div
      className="hairline"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-surface)',
        padding: '12px 14px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
      }}
    >
      <div>
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
            marginBottom: 2,
          }}
        >
          technical (year-2 sealed)
        </div>
        <div
          className="mono"
          style={{ fontSize: 14, color: 'var(--color-ink)', letterSpacing: '0.04em' }}
        >
          {GBP(technical)}
        </div>
      </div>
      <div>
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
            marginBottom: 2,
          }}
        >
          sharp-competitor floor
        </div>
        <div
          className="mono"
          style={{ fontSize: 14, color: 'var(--color-warn)', letterSpacing: '0.04em' }}
        >
          {GBP(sharpFloor)}
        </div>
      </div>
      <div>
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
            marginBottom: 2,
          }}
        >
          broker target
        </div>
        <div
          className="mono"
          style={{ fontSize: 14, color: 'var(--color-ink)', letterSpacing: '0.04em' }}
        >
          {brokerTarget !== null ? GBP(brokerTarget) : '—'}
        </div>
      </div>
    </div>
  );
}

function CompetitiveContext({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-bg)',
        border: '0.5px solid var(--color-rule)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-faint)',
          marginBottom: 4,
        }}
      >
        competitive context
      </div>
      <div
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--color-ink-mute)',
          lineHeight: 1.55,
          letterSpacing: '-0.005em',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function OptionCard({
  option,
  selected,
  disabled,
  isLoading,
  onSelect,
}: {
  option: DefencePricingOption;
  selected: boolean;
  disabled: boolean;
  isLoading: boolean;
  onSelect: () => void;
}) {
  const recommended = option.recommended;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled || selected}
      whileHover={!disabled && !selected ? { backgroundColor: 'var(--color-sunken)' } : {}}
      transition={{ duration: 0.14 }}
      className="hairline"
      style={{
        textAlign: 'left',
        borderRadius: 'var(--radius-card)',
        padding: '14px 16px',
        background: selected ? 'rgba(201, 99, 66, 0.06)' : 'var(--color-surface)',
        borderColor: selected || recommended ? 'var(--color-accent)' : 'var(--color-rule-mid)',
        borderWidth: selected || recommended ? 1 : 0.5,
        cursor: disabled || selected ? 'default' : 'pointer',
        display: 'grid',
        gridTemplateColumns: '24px 1fr auto',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          marginTop: 4,
          borderRadius: 999,
          border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-rule-mid)'}`,
          background: selected ? 'var(--color-accent)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden
      >
        {selected && (
          <span
            style={{
              width: 6,
              height: 6,
              background: 'var(--color-bg)',
              borderRadius: 999,
            }}
          />
        )}
      </div>
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
            option {option.id}
          </span>
          {recommended && (
            <span
              className="mono inline-flex items-center gap-1"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--color-accent)',
              }}
            >
              <Star size={10} strokeWidth={1.75} fill="currentColor" />
              recommended
            </span>
          )}
        </div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            marginTop: 6,
            lineHeight: 1.55,
            letterSpacing: '-0.005em',
          }}
        >
          {option.rationale}
        </div>
      </div>
      <div
        className="mono"
        style={{
          fontSize: 16,
          color: recommended ? 'var(--color-accent)' : 'var(--color-ink)',
          letterSpacing: '0.04em',
          textAlign: 'right',
          fontWeight: 500,
        }}
      >
        {GBP(option.premium)}
        {isLoading && (
          <div
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 11,
              color: 'var(--color-ink-mute)',
              marginTop: 4,
            }}
          >
            generating slip…
          </div>
        )}
      </div>
    </motion.button>
  );
}

function TheGold({
  sharpFloor,
  recommended,
}: {
  sharpFloor: number;
  recommended: DefencePricingOption | undefined;
}) {
  if (!recommended) return null;
  return (
    <div
      style={{
        marginTop: 14,
        padding: '12px 14px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-bg)',
        borderLeft: '2px solid var(--color-accent)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-accent)',
          marginBottom: 4,
        }}
      >
        the gold · what the cockpit recommends
      </div>
      <div
        className="serif"
        style={{
          fontSize: 13.5,
          color: 'var(--color-ink)',
          lineHeight: 1.6,
          letterSpacing: '-0.005em',
        }}
      >
        Defend at <strong>{GBP(recommended.premium)}</strong> — above the sharp-competitor
        hold floor of {GBP(sharpFloor)}, holds margin while signalling commercial willingness.
      </div>
    </div>
  );
}
