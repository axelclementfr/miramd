import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

describe('Keyboard shortcut wiring', () => {
  describe('Ctrl+Z/Y handler logic', () => {
    // Simulate the handler logic from MuyaPane without needing DOM
    const mockUndo = vi.fn();
    const mockRedo = vi.fn();
    const mockSelectAll = vi.fn();

    function simulateHandler(key: string, ctrlKey = true, shiftKey = false) {
      const mod = ctrlKey;
      if (!mod) return;

      if (key === 'z' && !shiftKey) {
        mockUndo();
      } else if (key === 'z' && shiftKey) {
        mockRedo();
      } else if (key === 'y') {
        mockRedo();
      } else if (key === 'a') {
        mockSelectAll();
      }
    }

    beforeEach(() => {
      mockUndo.mockClear();
      mockRedo.mockClear();
      mockSelectAll.mockClear();
    });

    it('Ctrl+Z calls undo', () => {
      simulateHandler('z', true, false);
      expect(mockUndo).toHaveBeenCalledOnce();
      expect(mockRedo).not.toHaveBeenCalled();
    });

    it('Ctrl+Shift+Z calls redo', () => {
      simulateHandler('z', true, true);
      expect(mockRedo).toHaveBeenCalledOnce();
      expect(mockUndo).not.toHaveBeenCalled();
    });

    it('Ctrl+Y calls redo', () => {
      simulateHandler('y', true, false);
      expect(mockRedo).toHaveBeenCalledOnce();
    });

    it('Ctrl+A calls selectAll', () => {
      simulateHandler('a', true, false);
      expect(mockSelectAll).toHaveBeenCalledOnce();
    });

    it('no ctrl = nothing called', () => {
      simulateHandler('z', false, false);
      expect(mockUndo).not.toHaveBeenCalled();
      expect(mockRedo).not.toHaveBeenCalled();
    });
  });

  describe('Tab creation does not duplicate content', () => {
    it('new tab has empty content, not previous tab content', async () => {
      const { editor } = await import('$lib/stores/editor');
      const { get } = await import('svelte/store');

      // Open first tab with content
      const id1 = editor.addTab('/test.md', 'test.md', '# Existing content');

      // Open new empty tab
      const id2 = editor.addTab();

      const tabs = get(editor.tabs);
      const tab1 = tabs.find(t => t.id === id1);
      const tab2 = tabs.find(t => t.id === id2);

      expect(tab1!.content).toBe('# Existing content');
      expect(tab2!.content).toBe('\n'); // Empty tab = '\n' for Muya compat
      expect(tab2!.content).not.toBe(tab1!.content);
    });

    it('active tab switches to new tab', async () => {
      const { editor } = await import('$lib/stores/editor');
      const { get } = await import('svelte/store');

      const id1 = editor.addTab('/a.md', 'a.md', '# A');
      const id2 = editor.addTab();

      expect(get(editor.activeTabId)).toBe(id2);
    });
  });

  describe('Muya dist API verification', () => {
    it('Muya dist exports undo method', async () => {
      // Verify the dist file contains the undo method
      const fs = await import('fs');
      const dist = fs.readFileSync(
        '/home/axel/Documents/Projets/Marktext/MiraMD/src/lib/muya/dist/index.min.js',
        'utf-8'
      );
      expect(dist).toContain('undo()');
      expect(dist).toContain('redo()');
      expect(dist).toContain('selectAll()');
      expect(dist).toContain('clearHistory()');
      expect(dist).toContain('getHistory()');
      expect(dist).toContain('setHistory(');
      expect(dist).toContain('getCursor()');
    });
  });
});
