import { useRef } from 'react';
import { useObserveChapter } from './ChapterNav';
import type { ChapterId } from '@/store/canvasUI';

/**
 * Lightweight wrapper that gives a section a [data-chapter] anchor
 * for the chapter nav (click-to-scroll target) AND registers it
 * with the IntersectionObserver-based active-chapter detector.
 *
 * Used at section call sites in ExtractionSequence and PostBindCanvas
 * to make the chapter nav functional without rewiring every section
 * component to use SectionCollapse. (SectionCollapse itself uses the
 * same hook; this is the smaller surface-area integration for now.)
 */
export function ChapterAnchor({
  chapter,
  children,
}: {
  chapter: ChapterId;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useObserveChapter(chapter, ref);
  return (
    <div
      ref={ref}
      data-chapter={chapter}
      style={{ scrollMarginTop: 80 /* clear sticky nav + ribbon */ }}
    >
      {children}
    </div>
  );
}
