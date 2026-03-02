import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ words: 0, chars: 0, lines: 0, paragraphs: 0 })
}));

// Import after mocking
const { editor } = await import('$lib/stores/editor');

describe('Editor Store', () => {
  describe('addTab', () => {
    it('creates a tab with correct defaults', () => {
      const id = editor.addTab();
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab).toBeDefined();
      expect(tab!.name).toBe('Untitled.md');
      expect(tab!.isModified).toBe(false);
    });

    it('new empty tab has \\n as content (Muya compat)', () => {
      const id = editor.addTab();
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.content).toBe('\n');
      expect(tab!.savedContent).toBe('\n');
    });

    it('tab with content preserves content', () => {
      const id = editor.addTab('/test.md', 'test.md', '# Hello');
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.content).toBe('# Hello');
    });

    it('sets activeTabId to new tab', () => {
      const id = editor.addTab();
      expect(get(editor.activeTabId)).toBe(id);
    });
  });

  describe('updateContent', () => {
    it('marks tab as modified when content differs from saved', () => {
      const id = editor.addTab(null, 'test.md', 'original');
      editor.updateContent(id, 'modified');
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.isModified).toBe(true);
    });

    it('does not mark as modified when content equals saved', () => {
      const id = editor.addTab(null, 'test.md', 'same');
      editor.updateContent(id, 'same');
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.isModified).toBe(false);
    });
  });

  describe('markSaved', () => {
    it('resets isModified to false', () => {
      const id = editor.addTab(null, 'test.md', 'original');
      editor.updateContent(id, 'modified');
      editor.markSaved(id, 'modified');
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.isModified).toBe(false);
    });

    it('syncs savedContent with provided content', () => {
      const id = editor.addTab();
      editor.markSaved(id, '\n');
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.id === id);
      expect(tab!.savedContent).toBe('\n');
      expect(tab!.content).toBe('\n');
    });
  });

  describe('closeTab', () => {
    it('removes the tab', () => {
      const id = editor.addTab();
      editor.closeTab(id);
      const tabs = get(editor.tabs);
      expect(tabs.find(t => t.id === id)).toBeUndefined();
    });

    it('activates adjacent tab after closing', () => {
      const id1 = editor.addTab(null, 'first.md', 'a');
      const id2 = editor.addTab(null, 'second.md', 'b');
      editor.closeTab(id2);
      expect(get(editor.activeTabId)).toBe(id1);
    });

    it('sets activeTabId to null when last tab closed', () => {
      // Close all existing tabs first
      const allTabs = get(editor.tabs);
      for (const t of allTabs) {
        editor.closeTab(t.id);
      }
      expect(get(editor.activeTabId)).toBeNull();
    });
  });

  describe('hasUnsavedChanges', () => {
    it('returns false when no tabs are modified', () => {
      // Close all tabs, add a fresh one
      const allTabs = get(editor.tabs);
      for (const t of allTabs) editor.closeTab(t.id);
      editor.addTab();
      expect(editor.hasUnsavedChanges()).toBe(false);
    });

    it('returns true when a tab is modified', () => {
      const id = editor.addTab(null, 'test.md', 'original');
      editor.updateContent(id, 'modified');
      expect(editor.hasUnsavedChanges()).toBe(true);
    });
  });
});
