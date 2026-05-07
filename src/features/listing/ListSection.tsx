import { motion } from 'framer-motion';
import type { SectionGroup } from '@/lib/listing';
import { SubmissionRow } from './SubmissionRow';

export function ListSection({ group, index }: { group: SectionGroup; index: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1], delay: index * 0.08 }}
      style={{ borderTop: index === 0 ? 0 : '0.5px solid var(--color-rule-mid)' }}
    >
      <div
        className="hairline-b flex items-baseline justify-between"
        style={{
          padding: '16px 36px 10px',
          background: 'var(--color-bg)',
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-faint)',
          }}
        >
          {group.label}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--color-ink-mute)',
          }}
        >
          · {group.count}
        </span>
      </div>
      {group.entries.length === 0 ? (
        <div
          className="serif"
          style={{
            fontStyle: 'italic',
            fontSize: 12.5,
            color: 'var(--color-ink-faint)',
            padding: '14px 36px 18px',
            letterSpacing: '-0.005em',
          }}
        >
          0 matching
        </div>
      ) : (
        group.entries.map((e) => <SubmissionRow key={e.ref} entry={e} />)
      )}
    </motion.section>
  );
}
