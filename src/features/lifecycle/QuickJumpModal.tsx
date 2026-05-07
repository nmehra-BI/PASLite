import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRanBerri } from '@/store';
import { useCanvasUI } from '@/store/canvasUI';
import { deriveChapters } from '@/lib/chapters';
import { scrollToChapter } from './ChapterNav';

/**
 * ⌘/Ctrl + K — quick-jump chapter palette. Centered, ~400px wide,
 * search input + filtered chapter list. Arrow keys to navigate,
 * Enter to jump, ESC to close.
 */
export function QuickJumpModal() {
  const open = useCanvasUI((s) => s.quickJumpOpen);
  const setOpen = useCanvasUI((s) => s.setQuickJumpOpen);
  const state = useRanBerri();
  const chapters = useMemo(() => deriveChapters(state).filter((c) => c.available), [state]);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  // Reset state when modal opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q));
  }, [chapters, query]);

  // Keep highlight in bounds when filter changes.
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered.length, highlight]);

  function selectAt(i: number) {
    const item = filtered[i];
    if (!item) return;
    setOpen(false);
    scrollToChapter(item.id);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label="Jump to chapter"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(31, 30, 29, 0.32)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="hairline"
            style={{
              width: 400,
              maxWidth: '92vw',
              background: '#FBF7EF',
              borderRadius: 6,
              boxShadow: '0 12px 32px rgba(31, 30, 29, 0.18)',
              overflow: 'hidden',
            }}
          >
            <input
              autoFocus
              type="search"
              value={query}
              placeholder="Jump to chapter…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((h) => Math.min(filtered.length - 1, h + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight((h) => Math.max(0, h - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  selectAt(highlight);
                } else if (e.key === 'Escape') {
                  setOpen(false);
                }
              }}
              className="serif"
              style={{
                width: '100%',
                padding: '14px 18px',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: 15,
                color: 'var(--color-ink)',
                background: 'transparent',
                border: 0,
                outline: 'none',
                borderBottom: '0.5px solid var(--color-rule-mid)',
                letterSpacing: '-0.005em',
              }}
            />
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                maxHeight: '40vh',
                overflowY: 'auto',
              }}
            >
              {filtered.length === 0 ? (
                <li
                  className="serif"
                  style={{
                    padding: '14px 18px',
                    fontStyle: 'italic',
                    fontSize: 13,
                    color: 'var(--color-ink-faint)',
                  }}
                >
                  No chapters match.
                </li>
              ) : (
                filtered.map((c, i) => {
                  const isHi = i === highlight;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selectAt(i)}
                        onMouseEnter={() => setHighlight(i)}
                        className="serif"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 18px',
                          background: isHi ? 'rgba(201, 99, 66, 0.06)' : 'transparent',
                          borderLeft: isHi ? '1.5px solid var(--color-accent)' : '1.5px solid transparent',
                          border: 0,
                          fontStyle: 'italic',
                          fontSize: 13.5,
                          color: 'var(--color-ink)',
                          cursor: 'pointer',
                          letterSpacing: '-0.005em',
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 10,
                        }}
                      >
                        <span style={{ flex: 1 }}>{c.label}</span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: 'var(--color-ink-faint)',
                          }}
                        >
                          {c.status}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <div
              className="hairline-t"
              style={{
                padding: '8px 14px',
                background: 'var(--color-bg)',
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.08em',
                  color: 'var(--color-ink-faint)',
                  textTransform: 'lowercase',
                }}
              >
                ↑↓ navigate · ↵ select · esc cancel
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
