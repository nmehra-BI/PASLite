import { describe, expect, it, beforeEach } from 'vitest';
import { useCanvasUI, ALL_CHAPTER_IDS } from './canvasUI';

describe('canvasUI store', () => {
  beforeEach(() => {
    useCanvasUI.setState({
      manualOverrides: {},
      activeChapter: null,
      quickJumpOpen: false,
      inspectorHistory: [],
    });
  });

  it('setManualOverride stores per-chapter expanded state; undefined clears', () => {
    useCanvasUI.getState().setManualOverride('rating', true);
    expect(useCanvasUI.getState().manualOverrides['rating']).toBe(true);
    useCanvasUI.getState().setManualOverride('rating', false);
    expect(useCanvasUI.getState().manualOverrides['rating']).toBe(false);
    useCanvasUI.getState().setManualOverride('rating', undefined);
    expect(useCanvasUI.getState().manualOverrides['rating']).toBeUndefined();
  });

  it('collapseAllCompleted writes false for every chapter id', () => {
    useCanvasUI.getState().collapseAllCompleted();
    for (const c of ALL_CHAPTER_IDS) {
      expect(useCanvasUI.getState().manualOverrides[c]).toBe(false);
    }
  });

  it('expandAllSections writes true for every chapter id', () => {
    useCanvasUI.getState().expandAllSections();
    for (const c of ALL_CHAPTER_IDS) {
      expect(useCanvasUI.getState().manualOverrides[c]).toBe(true);
    }
  });

  it('inspector history pushes/pops in stack order', () => {
    useCanvasUI.getState().pushInspector({ kind: 'factor', title: 'FCT-002' });
    useCanvasUI.getState().pushInspector({ kind: 'binder', title: 'BND-29104' });
    expect(useCanvasUI.getState().inspectorHistory).toHaveLength(2);
    useCanvasUI.getState().popInspector();
    expect(useCanvasUI.getState().inspectorHistory).toHaveLength(1);
    expect(useCanvasUI.getState().inspectorHistory[0]!.kind).toBe('factor');
    useCanvasUI.getState().clearInspectorHistory();
    expect(useCanvasUI.getState().inspectorHistory).toHaveLength(0);
  });

  it('setActiveChapter accepts null to clear', () => {
    useCanvasUI.getState().setActiveChapter('rating');
    expect(useCanvasUI.getState().activeChapter).toBe('rating');
    useCanvasUI.getState().setActiveChapter(null);
    expect(useCanvasUI.getState().activeChapter).toBeNull();
  });
});
