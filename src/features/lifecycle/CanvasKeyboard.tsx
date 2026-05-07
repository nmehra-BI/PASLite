import { useEffect } from 'react';
import { useRanBerri } from '@/store';
import { useCanvasUI, type ChapterId, ALL_CHAPTER_IDS } from '@/store/canvasUI';
import { deriveChapters } from '@/lib/chapters';
import { scrollToChapter } from './ChapterNav';

/**
 * Module 13 — keyboard shortcuts. Mounted once at the cockpit top
 * level. Inactive when a text input/textarea/contenteditable is
 * focused.
 *
 *   ⌘/Ctrl + K  open quick-jump modal
 *   ⌘/Ctrl + .  collapse all completed sections
 *   ⌘/Ctrl + ,  expand all sections
 *   ←           previous chapter
 *   →           next chapter
 *   ESC         close inspector / quick-jump (existing close logic)
 */
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
      if (!meta && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
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
