import { motion } from 'framer-motion';
import { useIntake } from './intakeStore';
import { SourceDocPreview } from './SourceDocPreview';
import { ExtractedView } from './ExtractedView';
import { Inspector } from './Inspector';
import { EnrichmentSection } from '@/features/enrichment';
import { TriageSection } from '@/features/triage';
import { RatingSection } from '@/features/rating';
import { QuoteSection } from '@/features/quote';
import { RecommendationSection } from '@/features/recommendation';

/**
 * The two-column composition that frames the cinematic extraction and,
 * once settled, the editorial extracted view.
 *
 *   ┌─────────────────────────┬─────────────────────────┐
 *   │  source preview         │  extraction panel       │
 *   │  (email + slip pages)   │  (fields appear here)   │
 *   └─────────────────────────┴─────────────────────────┘
 *
 * The Inspector overlays the right column when a field is opened.
 */
export function ExtractionSequence() {
  const phase = useIntake((s) => s.phase);
  const showSplit =
    phase === 'receiving' ||
    phase === 'reading' ||
    phase === 'extracting' ||
    phase === 'complete';

  if (!showSplit) return null;

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)',
        minHeight: 0,
        position: 'relative',
        background: 'var(--color-bg)',
      }}
    >
      <motion.div
        key="left"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        className="hairline-r"
        style={{
          background: 'var(--color-bg)',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <SourceDocPreview />
      </motion.div>

      <motion.div
        key="right"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        style={{
          background: 'var(--color-surface)',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {phase === 'receiving' || phase === 'reading' ? (
          <ExtractingHeader phase={phase} />
        ) : (
          <ExtractedView>
            <EnrichmentSection />
            <TriageSection />
            <RatingSection />
            <QuoteSection />
            <RecommendationSection />
          </ExtractedView>
        )}
        <Inspector />
      </motion.div>
    </div>
  );
}

function ExtractingHeader({ phase }: { phase: 'receiving' | 'reading' }) {
  const label = phase === 'receiving' ? 'Receiving submission' : 'Reading attachments';
  return (
    <div style={{ padding: '24px 28px' }}>
      <div className="eyebrow mb-3">extracting</div>
      <p
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 17,
          color: 'var(--color-ink-mute)',
          margin: 0,
          letterSpacing: '-0.005em',
        }}
      >
        {label}&hellip;
      </p>
    </div>
  );
}
