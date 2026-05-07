import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { MorningBriefing } from '@/lib/listing';

/**
 * The morning-briefing hero. Greeting + count + breakdown + a
 * streaming italic-serif marginalia that's the cockpit speaking to
 * the underwriter as a senior colleague.
 */
export function HeroStrip({ briefing }: { briefing: MorningBriefing }) {
  return (
    <section
      className="hairline-b"
      style={{
        padding: '32px 36px 28px',
        background: 'var(--color-surface)',
      }}
    >
      <div
        className="serif"
        style={{
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: '-0.012em',
          color: 'var(--color-ink)',
        }}
      >
        {briefing.greeting}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          letterSpacing: '0.06em',
          color: 'var(--color-ink-faint)',
          marginTop: 4,
          textTransform: 'lowercase',
        }}
      >
        {briefing.countLabel}
      </div>

      <div
        className="serif"
        style={{
          fontSize: 16,
          color: 'var(--color-ink)',
          marginTop: 16,
          letterSpacing: '-0.005em',
        }}
      >
        {briefing.breakdown}
      </div>

      <StreamingMarginalia text={briefing.marginalia} />
    </section>
  );
}

function StreamingMarginalia({ text }: { text: string }) {
  // Stream word-by-word over ~1.4s. Persist completion in a ref so a
  // re-render doesn't restart the animation if the parent re-runs.
  const [shown, setShown] = useState('');
  useEffect(() => {
    const words = text.split(' ');
    let i = 0;
    setShown('');
    const interval = window.setInterval(() => {
      i += 1;
      setShown(words.slice(0, i).join(' '));
      if (i >= words.length) window.clearInterval(interval);
    }, Math.max(20, Math.floor(1400 / words.length)));
    return () => window.clearInterval(interval);
  }, [text]);

  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32 }}
      className="serif"
      style={{
        fontStyle: 'italic',
        fontSize: 13.5,
        color: 'var(--color-ink-faint)',
        margin: '14px 0 0',
        maxWidth: 720,
        lineHeight: 1.6,
        letterSpacing: '-0.005em',
      }}
    >
      {shown || ' '}
    </motion.p>
  );
}
