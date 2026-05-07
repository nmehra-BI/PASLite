import { useEffect } from 'react';
import { useRanBerri } from '@/store';
import { useCanvasUI, type ChapterId, ALL_CHAPTER_IDS } from '@/store/canvasUI';
import { deriveChapters } from '@/lib/chapters';
import { scrollToChapter } from './ChapterNav';
import type { LifecycleMilestone } from '@/lib/fixtures';

/**
 * Module 13 — keyboard shortcuts. Mounted once at the cockpit top
 * level. Inactive when a text input/textarea/contenteditable is
 * focused.
 *
 *   ⌘/Ctrl + K       open quick-jump modal
 *   ⌘/Ctrl + .       collapse all completed sections
 *   ⌘/Ctrl + ,       expand all sections
 *   ←                previous chapter
 *   →                next chapter
 *   Shift + ←        previous lifecycle milestone (ribbon scrub)
 *   Shift + →        next lifecycle milestone (ribbon scrub)
 *   Home             first lifecycle milestone (Quote)
 *   End              return to current "now" milestone
 *   ESC              close inspector / quick-jump (existing close logic)
 *
 * Note: Shift+arrow is used for ribbon scrub to avoid colliding with
 * the existing unmodified-arrow chapter-nav shortcut.
 */
const MILESTONE_NAV_ORDER: LifecycleMilestone[] = [
  'quote',
  'quoted',
  'bind',
  'mta-04',
  'cancel',
  'renewal',
];
export function CanvasKeyboard() {
  const setQuickJumpOpen = useCanvasUI((s) => s.setQuickJumpOpen);
  const collapseAllCompleted = useCanvasUI((s) => s.collapseAllCompleted);
  const expandAllSections = useCanvasUI((s) => s.expandAllSections);
  const activeChapter = useCanvasUI((s) => s.activeChapter);
  const setAuditLogOpen = useRanBerri((s) => s.setAuditLogOpen);
  const setShowCertificate = useRanBerri((s) => s.setShowCertificate);
  const setInspectingSubjectivity = useRanBerri((s) => s.setInspectingSubjectivity);

  useEffect(() => {
    function isEditingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function handler(e: KeyboardEvent) {
      if (isEditingTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickJumpOpen(true);
        return;
      }
      if (meta && e.key === '.') {
        e.preventDefault();
        collapseAllCompleted();
        return;
      }
      if (meta && e.key === ',') {
        e.preventDefault();
        expandAllSections();
        return;
      }
      if (e.key === 'Escape') {
        // Close inspectors + drawers if any open. Quick-jump's own
        // ESC handler runs locally inside the modal.
        setAuditLogOpen(false);
        setShowCertificate(false);
        setInspectingSubjectivity(null);
        return;
      }
      // Ribbon scrub: Shift+arrows step through visible milestones;
      // Home goes to the first milestone; End returns to "now".
      if (
        e.shiftKey &&
        !meta &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        const dir: -1 | 1 = e.key === 'ArrowLeft' ? -1 : 1;
        const target = neighborMilestone(dir, useRanBerri.getState());
        if (target) {
          e.preventDefault();
          useRanBerri.getState().scrubLifecycle(target);
        }
        return;
      }
      if (!meta && !e.shiftKey && e.key === 'Home') {
        e.preventDefault();
        const first = visibleMilestoneOrder(useRanBerri.getState())[0];
        if (first) useRanBerri.getState().scrubLifecycle(first);
        return;
      }
      if (!meta && !e.shiftKey && e.key === 'End') {
        e.preventDefault();
        const s = useRanBerri.getState();
        s.scrubLifecycle(s.lifecycle.now);
        return;
      }

      if (!meta && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const next = neighborChapter(
          activeChapter,
          e.key === 'ArrowLeft' ? -1 : 1,
          useRanBerri.getState(),
        );
        if (next) {
          e.preventDefault();
          scrollToChapter(next);
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    setQuickJumpOpen,
    collapseAllCompleted,
    expandAllSections,
    setAuditLogOpen,
    setShowCertificate,
    setInspectingSubjectivity,
    activeChapter,
  ]);

  return null;
}

function neighborChapter(
  current: ChapterId | null,
  dir: -1 | 1,
  state: ReturnType<typeof useRanBerri.getState>,
): ChapterId | null {
  const chapters = deriveChapters(state).filter((c) => c.available);
  if (chapters.length === 0) return null;
  const cur = current ?? ALL_CHAPTER_IDS[0]!;
  const idx = chapters.findIndex((c) => c.id === cur);
  if (idx < 0) return chapters[0]!.id;
  const nextIdx = idx + dir;
  if (nextIdx < 0 || nextIdx >= chapters.length) return null;
  return chapters[nextIdx]!.id;
}

/** Visible milestone order for the current submission state — drops
 *  cancel once the policy has renewed and renewal once the policy
 *  has cancelled, mirroring the ribbon's own filtering. */
function visibleMilestoneOrder(
  state: ReturnType<typeof useRanBerri.getState>,
): LifecycleMilestone[] {
  const isCancelled =
    state.cancellation.phase === 'committed' ||
    state.cancellation.phase === 'sent';
  const isRenewed =
    state.renewal.phase === 'committed' || state.renewal.phase === 'sent';
  return MILESTONE_NAV_ORDER.filter((m) => {
    if (isCancelled && m === 'renewal') return false;
    if (isRenewed && m === 'cancel') return false;
    return true;
  });
}

function neighborMilestone(
  dir: -1 | 1,
  state: ReturnType<typeof useRanBerri.getState>,
): LifecycleMilestone | null {
  const order = visibleMilestoneOrder(state);
  const cur = state.lifecycle.cursor;
  const idx = order.indexOf(cur);
  if (idx < 0) return order[0] ?? null;
  const next = idx + dir;
  if (next < 0 || next >= order.length) return null;
  return order[next]!;
}
