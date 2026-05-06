import { motion } from 'framer-motion';
import { useRanBerri } from '@/store';
import { capacityHeadroom, getCapacityLedger } from '@/lib/fixtures/capacityLedger';

/**
 * Quick auto-pass capacity gauge for the MTA. Shows the same syndicate
 * status as module 4's CapacityGauge; highlights the delta consumption
 * the MTA introduces.
 */
export function CapacityRecheckPanel() {
  const mta = useRanBerri((s) => s.mta);
  if (!mta.capacity) return null;
  if (mta.phase === 'idle' || mta.phase === 'received' || mta.phase === 'extracting') return null;

  const ledger = getCapacityLedger();
  const cap = ledger.annualAggregateCap;
  const headroom = capacityHeadroom(ledger);
  const consumedPct = ((cap - headroom) / cap) * 100;
  const headroomPct = (headroom / cap) * 100;

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
      className="hairline-t"
      style={{ padding: '18px 28px' }}
    >
      <header style={{ marginBottom: 12 }}>
        <div className="eyebrow">capacity · re-check</div>
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--color-ink-mute)',
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          {ledger.syndicate} · {ledger.segment}
        </div>
      </header>

      <div
        style={{
          height: 8,
          background: 'var(--color-sunken)',
          borderRadius: 999,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${consumedPct}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          style={{
            height: '100%',
            background: mta.capacity.sufficient ? 'var(--color-ink-soft)' : 'var(--color-danger)',
          }}
        />
      </div>

      <div
        className="mono"
        style={{
          marginTop: 8,
          fontSize: 10.5,
          letterSpacing: '0.06em',
          color: 'var(--color-ink-mute)',
        }}
      >
        £{(cap / 1_000_000).toFixed(1)}M cap · £{((cap - headroom) / 1_000_000).toFixed(1)}M consumed · £{(headroom / 1_000_000).toFixed(1)}M headroom ({headroomPct.toFixed(1)}%)
      </div>

      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 12.5,
          color: mta.capacity.sufficient ? 'var(--color-ink-mute)' : 'var(--color-danger)',
          marginTop: 10,
          marginBottom: 0,
          lineHeight: 1.55,
          letterSpacing: '-0.005em',
        }}
      >
        This MTA would consume an additional £{mta.capacity.deltaConsumption.toLocaleString('en-GB')} (delta to bound allocation). New total consumption: £{mta.capacity.newTotalConsumption.toLocaleString('en-GB')}.
        {mta.capacity.sufficient ? ' Within available headroom — auto-pass.' : ' Capacity exceeds allocation; refer to senior.'}
      </p>
    </motion.section>
  );
}
