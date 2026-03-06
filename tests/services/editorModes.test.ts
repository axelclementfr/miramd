import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

// Mock muyaService
vi.mock('$lib/services/muya', () => ({
  muyaService: {
    isReady: vi.fn().mockReturnValue(false),
    getMarkdown: vi.fn().mockReturnValue(''),
    setMarkdown: vi.fn(),
    applyPreferences: vi.fn(),
    getInstance: vi.fn().mockReturnValue(null),
  },
}));

const { preferences } = await import('$lib/stores/preferences');
const { editor } = await import('$lib/stores/editor');
const { editorModes } = await import('$lib/services/editorModes');

describe('EditorModes', () => {
  beforeEach(() => {
    // Reset preferences to defaults
    preferences.patch({
      sourceCodeMode: false,
      splitView: false,
      focusMode: false,
      typewriterMode: false,
    });
    // Reset tabs and add a fresh active one (readOnly is per-tab now)
    const allTabs = get(editor.tabs);
    for (const t of allTabs) editor.closeTab(t.id);
    editor.addTab(null, 'test.md', 'hello');
  });

  describe('toggleReadOnly', () => {
    it('toggles the active tab readOnly from false to true', () => {
      editorModes.toggleReadOnly();
      const state = editorModes.getState();
      expect(state.readOnly).toBe(true);
    });

    it('toggles the active tab readOnly from true to false', () => {
      const id = get(editor.activeTabId)!;
      editor.setTabReadOnly(id, true);
      editorModes.toggleReadOnly();
      const state = editorModes.getState();
      expect(state.readOnly).toBe(false);
    });

    it('is independent per tab', () => {
      const id1 = get(editor.activeTabId)!;
      editor.setTabReadOnly(id1, true);
      const id2 = editor.addTab(null, 'other.md', '');
      // Switching to id2 should show editable (default false)
      expect(get(editor.activeTab)?.readOnly).toBeFalsy();
      // The first tab keeps its readOnly state
      const tabs = get(editor.tabs);
      expect(tabs.find(t => t.id === id1)?.readOnly).toBe(true);
      expect(tabs.find(t => t.id === id2)?.readOnly).toBeFalsy();
    });
  });

  describe('readOnly body class — lock-mode CSS hook', () => {
    it('adds muya-readonly to <body> when active tab becomes readOnly', () => {
      const cleanup = editorModes.init();
      try {
        document.body.classList.remove('muya-readonly');
        const id = get(editor.activeTabId)!;
        editor.setTabReadOnly(id, true);
        expect(document.body.classList.contains('muya-readonly')).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('removes muya-readonly when active tab returns to editable', () => {
      const cleanup = editorModes.init();
      try {
        const id = get(editor.activeTabId)!;
        editor.setTabReadOnly(id, true);
        editor.setTabReadOnly(id, false);
        expect(document.body.classList.contains('muya-readonly')).toBe(false);
      } finally {
        cleanup();
      }
    });

    it('updates the body class when switching to a tab with different readOnly', () => {
      const cleanup = editorModes.init();
      try {
        const lockedId = get(editor.activeTabId)!;
        editor.setTabReadOnly(lockedId, true);
        expect(document.body.classList.contains('muya-readonly')).toBe(true);
        const editableId = editor.addTab(null, 'editable.md', '');
        // editor.addTab activates the new tab automatically
        expect(get(editor.activeTabId)).toBe(editableId);
        expect(document.body.classList.contains('muya-readonly')).toBe(false);
      } finally {
        cleanup();
      }
    });
  });

  describe('toggleSource', () => {
    it('toggles sourceCode from false to true', () => {
      editorModes.toggleSource();
      const state = editorModes.getState();
      expect(state.sourceCode).toBe(true);
    });

    it('disables focusMode and typewriterMode when entering source mode', () => {
      preferences.patch({ focusMode: true, typewriterMode: true });
      editorModes.toggleSource();
      const state = editorModes.getState();
      expect(state.sourceCode).toBe(true);
      expect(state.focusMode).toBe(false);
      expect(state.typewriterMode).toBe(false);
    });

    it('toggles sourceCode from true to false', () => {
      preferences.patch({ sourceCodeMode: true });
      editorModes.toggleSource();
      const state = editorModes.getState();
      expect(state.sourceCode).toBe(false);
    });
  });

  describe('toggleSplit', () => {
    it('toggles splitView from false to true', () => {
      editorModes.toggleSplit();
      const state = editorModes.getState();
      expect(state.splitView).toBe(true);
    });

    it('toggles splitView from true to false', () => {
      preferences.patch({ splitView: true });
      editorModes.toggleSplit();
      const state = editorModes.getState();
      expect(state.splitView).toBe(false);
    });
  });

  describe('toggleFocus', () => {
    it('toggles focusMode from false to true', () => {
      editorModes.toggleFocus();
      const state = editorModes.getState();
      expect(state.focusMode).toBe(true);
    });

    it('toggles focusMode from true to false', () => {
      preferences.patch({ focusMode: true });
      editorModes.toggleFocus();
      const state = editorModes.getState();
      expect(state.focusMode).toBe(false);
    });
  });

  describe('toggleTypewriter', () => {
    it('toggles typewriterMode from false to true', () => {
      editorModes.toggleTypewriter();
      const state = editorModes.getState();
      expect(state.typewriterMode).toBe(true);
    });

    it('toggles typewriterMode from true to false', () => {
      preferences.patch({ typewriterMode: true });
      editorModes.toggleTypewriter();
      const state = editorModes.getState();
      expect(state.typewriterMode).toBe(false);
    });
  });

  describe('getState', () => {
    it('returns current state combining preferences and active tab readOnly', () => {
      preferences.patch({
        sourceCodeMode: false,
        splitView: true,
        focusMode: false,
        typewriterMode: true,
      });
      const id = get(editor.activeTabId)!;
      editor.setTabReadOnly(id, true);
      const state = editorModes.getState();
      expect(state).toEqual({
        readOnly: true,
        sourceCode: false,
        splitView: true,
        focusMode: false,
        typewriterMode: true,
      });
    });
  });
});
