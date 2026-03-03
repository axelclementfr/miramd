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
const { editorModes } = await import('$lib/services/editorModes');

describe('EditorModes', () => {
  beforeEach(() => {
    // Reset preferences to defaults
    preferences.patch({
      readOnly: false,
      sourceCodeMode: false,
      splitView: false,
      focusMode: false,
      typewriterMode: false,
    });
  });

  describe('toggleReadOnly', () => {
    it('toggles readOnly from false to true', () => {
      editorModes.toggleReadOnly();
      const state = editorModes.getState();
      expect(state.readOnly).toBe(true);
    });

    it('toggles readOnly from true to false', () => {
      preferences.patch({ readOnly: true });
      editorModes.toggleReadOnly();
      const state = editorModes.getState();
      expect(state.readOnly).toBe(false);
    });
  });

  describe('readOnly body class — lock-mode CSS hook', () => {
    it('adds muya-readonly to <body> when readOnly becomes true', () => {
      const cleanup = editorModes.init();
      try {
        document.body.classList.remove('muya-readonly');
        preferences.patch({ readOnly: true });
        expect(document.body.classList.contains('muya-readonly')).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('removes muya-readonly when readOnly returns to false', () => {
      const cleanup = editorModes.init();
      try {
        preferences.patch({ readOnly: true });
        preferences.patch({ readOnly: false });
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
    it('returns current state from preferences', () => {
      preferences.patch({
        readOnly: true,
        sourceCodeMode: false,
        splitView: true,
        focusMode: false,
        typewriterMode: true,
      });
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
