import { useEffect, useMemo } from 'react';
import { useRanBerri } from '@/store';
import { useCanvasUI, type ChapterId } from '@/store/canvasUI';
import { deriveChapters } from '@/lib/chapters';
import { deriveCursorView } from '@/lib/lifecycle/cursorView';
import type { AuditEvent } from '@/lib/audit';

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

  // Polymorphic chapter availability: when the cursor is scrubbed
  // back to a historical milestone, chapters whose first event
  // postdates the cursor's effective time become unavailable —
  // grey + non-clickable, matching the sepia overlay on the canvas.
  const cursorView = deriveCursorView({
    cursor: state.lifecycle.cursor,
    now: state.lifecycle.now,
    baseBindAt: state.policy.baseBindAt,
    versionCount: state.policy.versions.length,
    firstMtaSignedAt: state.policy.versions[0]?.signedAt ?? null,
    cancelledAt: state.cancellation.committedAt,
    cancelled:
      state.cancellation.phase === 'committed' || state.cancellation.phase === 'sent',
    renewedAt: state.renewal.committedAt,
    renewed:
      state.renewal.phase === 'committed' || state.renewal.phase === 'sent',
  });
  const firstAtByChapter = useMemo(
    () => indexFirstEventByChapter(state.auditLog),
    [state.auditLog],
  );
  const historicalCutoffMs =
    cursorView.scrubbed && cursorView.effectiveAt
      ? new Date(cursorView.effectiveAt).getTime()
      : null;

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
        const firstAt = firstAtByChapter.get(c.id) ?? null;
        const postdates =
          historicalCutoffMs !== null &&
          firstAt !== null &&
          new Date(firstAt).getTime() > historicalCutoffMs;
        const effectivelyAvailable = c.available && !postdates;
        const color = !effectivelyAvailable
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
              disabled={!effectivelyAvailable}
              className="serif"
              aria-current={isActive ? 'true' : undefined}
              style={{
                fontStyle: 'italic',
                fontSize: 11.5,
                color,
                background: 'transparent',
                border: 0,
                padding: '2px 0',
                cursor: effectivelyAvailable ? 'pointer' : 'default',
                letterSpacing: '0.005em',
                transition: 'color 200ms cubic-bezier(0.4,0,0.2,1)',
                opacity: postdates ? 0.55 : 1,
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

/** Map each chapter id → ISO of its earliest event in the log. */
function indexFirstEventByChapter(log: AuditEvent[]): Map<ChapterId, string> {
  const out = new Map<ChapterId, string>();
  function record(id: ChapterId, at: string) {
    const prev = out.get(id);
    if (!prev || at < prev) out.set(id, at);
  }
  for (const e of log) {
    if (e.kind === 'extraction.started' || e.kind === 'submission.created') record('extraction', e.at);
    else if (e.kind.startsWith('enrichment.') || e.kind.startsWith('conflict.') || e.kind.startsWith('gap.')) record('enrichment', e.at);
    else if (e.kind.startsWith('triage.')) record('triage', e.at);
    else if (e.kind.startsWith('rating.')) record('rating', e.at);
    else if (e.kind.startsWith('slip.') || e.kind.startsWith('quote.') || e.kind.startsWith('email.')) record('quote', e.at);
    else if (e.kind.startsWith('recommendation.')) record('recommendation', e.at);
    else if (e.kind.startsWith('bind.') || e.kind === 'schedule.generated' || e.kind === 'schedule.sent' || e.kind === 'subjectivity.created') record('bind', e.at);
    else if (e.kind.startsWith('mta.')) record('mta-04', e.at);
    else if (e.kind.startsWith('cancellation.') || e.kind === 'bordereau.entryWritten' || e.kind === 'competitor.switchRecorded') record('cancellation', e.at);
    else if (e.kind.startsWith('renewal.') || e.kind === 'claim.recorded' || e.kind === 'subjectivity.satisfied') record('renewal', e.at);
  }
  return out;
}
