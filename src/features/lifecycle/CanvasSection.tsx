import { useMemo } from 'react';
import { useRanBerri } from '@/store';
import { deriveChapters } from '@/lib/chapters';
import type { ChapterId } from '@/store/canvasUI';
import { SectionCollapse } from './SectionCollapse';
import { SectionSummary } from './SectionSummary';

/**
 * Convenience wrapper that derives a chapter's status from the live
 * store and renders SectionCollapse with the appropriate summary.
 *
 *   <CanvasSection chapter="enrichment">
 *     <EnrichmentSection />
 *   </CanvasSection>
 *
 * Auto-collapse / auto-expand / coral left-border / pending greyout
 * all flow from the chapter's status at render time. Manual
 * overrides win once the user clicks the summary chevron.
 */
export function CanvasSection({
  chapter,
  children,
}: {
  chapter: ChapterId;
  children: React.ReactNode;
}) {
  const state = useRanBerri();
  const status = useMemo(() => {
    const all = deriveChapters(state);
    const found = all.find((c) => c.id === chapter);
    return found?.status ?? 'pending';
  }, [state, chapter]);
  return (
    <SectionCollapse
      chapter={chapter}
      status={status}
      summary={<SectionSummary chapter={chapter} />}
    >
      {children}
    </SectionCollapse>
  );
}
