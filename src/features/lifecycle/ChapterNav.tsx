import { useEffect } from 'react';
import { useRanBerri } from '@/store';
import { useCanvasUI, type ChapterId } from '@/store/canvasUI';
import { deriveChapters } from '@/lib/chapters';

/**
 * Sticky chapter strip below the lifecycle ribbon. Italic-serif
 * labels separated by hairline dots; current chapter coral, others
 * ink-mute, unavailable chapters ink-faint.
 *
 * Active-chapter detection is owned by the SectionCollapse wrappers
 * (they set up IntersectionObservers and write to canvasUI's
 * activeChapter); ChapterNav reads that and does not run its own
 * observers — keeps the spec's "navigate, not scrub" semantics tidy.
 */
export function ChapterNav() {
  const state = useRanBerri();
  const activeChapter = useCanvasUI((s) => s.activeChapter);
  const chapters = deriveChapters(state);
  const submission = state.submission;

  // No chapter nav before there's a submission.
  if (!submission) return null;

  return (
    <nav
      className="hairline-b"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 4,
        background: '#FBF7EF',
        padding: '10px 24px',
        flex: '0 0 auto',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        // Subtle gradient on the right edge as a scroll affordance
        // (visible on narrow viewports where the strip overflows).
        backgroundImage:
          'linear-gradient(to right, transparent 92%, rgba(31,30,29,0.04) 100%)',
      }}
      aria-label="Chapters"
    >
      {chapters.map((c, i) => {
        const isActive = activeChapter === c.id;
        const color = !c.available
          ? 'var(--color-ink-faint)'
          : isActive
            ? 'var(--color-accent)'
            : c.status === 'complete'
              ? 'var(--color-ink-soft)'
              : 'var(--color-ink-mute)';
        return (
          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'baseline' }}>
            {i > 0 && (
              <span
                aria-hidden
                style={{
                  margin: '0 10px',
                  color: 'var(--color-rule-mid)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9.5,
                }}
              >
                ·
              </span>
            )}
            <button
              type="button"
              onClick={() => scrollToChapter(c.id)}
              disabled={!c.available}
              className="serif"
              aria-current={isActive ? 'true' : undefined}
              style={{
                fontStyle: 'italic',
                fontSize: 11.5,
                color,
                background: 'transparent',
                border: 0,
                padding: '2px 0',
                cursor: c.available ? 'pointer' : 'default',
                letterSpacing: '0.005em',
                transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {c.label}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

export function scrollToChapter(chapter: ChapterId) {
  if (typeof document === 'undefined') return;
  const el = document.querySelector(`[data-chapter="${chapter}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Hook used by SectionCollapse to register a section header with
 * the IntersectionObserver-based active-chapter detector.
 */
export function useObserveChapter(
  chapter: ChapterId,
  ref: React.RefObject<HTMLElement | null>,
) {
  const setActiveChapter = useCanvasUI((s) => s.setActiveChapter);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveChapter(chapter);
            return;
          }
        }
      },
      // Trigger when the header is in the top ~20% of the viewport.
      { rootMargin: '0px 0px -75% 0px', threshold: 0.1 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [chapter, ref, setActiveChapter]);
}
