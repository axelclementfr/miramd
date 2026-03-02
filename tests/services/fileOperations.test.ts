import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

// Mock Tauri dialog
const mockOpen = vi.fn();
const mockSave = vi.fn();
const mockMessage = vi.fn();
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args: any[]) => mockOpen(...args),
  save: (...args: any[]) => mockSave(...args),
  message: (...args: any[]) => mockMessage(...args),
}));

// Mock muyaService
vi.mock('$lib/services/muya', () => ({
  muyaService: {
    isReady: vi.fn().mockReturnValue(false),
    getMarkdown: vi.fn().mockReturnValue(''),
  },
}));

// Mock toast
vi.mock('$lib/stores/toast', () => ({
  showToast: vi.fn(),
}));

const { editor } = await import('$lib/stores/editor');
const { openFileDialog, saveCurrentFile, closeTabWithConfirm, openFileFromPath } = await import('$lib/services/fileOperations');
const { muyaService } = await import('$lib/services/muya');
const { showToast } = await import('$lib/stores/toast');

const tr = (k: string) => k;

describe('fileOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Close all tabs
    const tabs = get(editor.tabs);
    for (const t of tabs) editor.closeTab(t.id);
  });

  describe('openFileDialog', () => {
    it('opens file and creates tab on happy path', async () => {
      mockOpen.mockResolvedValue('/home/user/test.md');
      mockInvoke.mockResolvedValue({
        path: '/home/user/test.md',
        name: 'test.md',
        content: '# Hello',
        size: 7,
      });

      await openFileDialog(tr);

      expect(mockOpen).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith('read_file', { path: '/home/user/test.md' });
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.name === 'test.md');
      expect(tab).toBeDefined();
      expect(tab!.content).toBe('# Hello');
    });

    it('does nothing when dialog is cancelled', async () => {
      mockOpen.mockResolvedValue(null);

      await openFileDialog(tr);

      expect(mockInvoke).not.toHaveBeenCalled();
      // No new tabs created (tabs were cleared in beforeEach)
      expect(get(editor.tabs)).toHaveLength(0);
    });

    it('shows toast on file read error', async () => {
      mockOpen.mockResolvedValue('/home/user/bad.md');
      mockInvoke.mockRejectedValue(new Error('Permission denied'));

      await openFileDialog(tr);

      expect(showToast).toHaveBeenCalledWith('error_open_file', 'error');
    });
  });

  describe('saveCurrentFile', () => {
    it('saves existing file with path', async () => {
      const id = editor.addTab('/home/user/doc.md', 'doc.md', 'original');
      editor.updateContent(id, 'modified');
      mockInvoke.mockResolvedValue(undefined);

      await saveCurrentFile(tr);

      // muyaService.isReady() returns false, so it uses tab.content
      expect(mockInvoke).toHaveBeenCalledWith('write_file', {
        path: '/home/user/doc.md',
        content: 'modified',
      });
    });

    it('triggers save dialog for new file without path', async () => {
      editor.addTab(null, 'Untitled.md', 'new content');
      mockSave.mockResolvedValue('/home/user/saved.md');
      mockInvoke.mockResolvedValue(undefined);

      await saveCurrentFile(tr);

      expect(mockSave).toHaveBeenCalledOnce();
      expect(mockInvoke).toHaveBeenCalledWith('write_file', {
        path: '/home/user/saved.md',
        content: 'new content',
      });
    });

    it('does nothing when save dialog is cancelled for new file', async () => {
      editor.addTab(null, 'Untitled.md', 'content');
      mockSave.mockResolvedValue(null);

      await saveCurrentFile(tr);

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('does nothing when no active tab', async () => {
      // No tabs exist
      await saveCurrentFile(tr);

      expect(mockInvoke).not.toHaveBeenCalled();
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('uses muya content when muya is ready', async () => {
      editor.addTab('/home/user/doc.md', 'doc.md', 'tab content');
      (muyaService.isReady as any).mockReturnValue(true);
      (muyaService.getMarkdown as any).mockReturnValue('muya content');
      mockInvoke.mockResolvedValue(undefined);

      await saveCurrentFile(tr);

      expect(mockInvoke).toHaveBeenCalledWith('write_file', {
        path: '/home/user/doc.md',
        content: 'muya content',
      });

      // Reset
      (muyaService.isReady as any).mockReturnValue(false);
    });

    it('shows toast on save error', async () => {
      editor.addTab('/home/user/doc.md', 'doc.md', 'content');
      mockInvoke.mockRejectedValue(new Error('Disk full'));

      await saveCurrentFile(tr);

      expect(showToast).toHaveBeenCalledWith('error_save_file', 'error');
    });
  });

  describe('closeTabWithConfirm', () => {
    it('closes unmodified tab directly', async () => {
      const id = editor.addTab(null, 'clean.md', 'content');

      await closeTabWithConfirm(id, tr);

      const tabs = get(editor.tabs);
      expect(tabs.find(t => t.id === id)).toBeUndefined();
      expect(mockMessage).not.toHaveBeenCalled();
    });

    it('shows confirmation for modified tab', async () => {
      const id = editor.addTab('/test.md', 'test.md', 'original');
      editor.updateContent(id, 'modified');
      mockMessage.mockResolvedValue('No'); // Discard

      await closeTabWithConfirm(id, tr);

      expect(mockMessage).toHaveBeenCalledOnce();
      // Tab should be closed (user chose discard)
      const tabs = get(editor.tabs);
      expect(tabs.find(t => t.id === id)).toBeUndefined();
    });

    it('cancels close when user clicks Cancel', async () => {
      const id = editor.addTab('/test.md', 'test.md', 'original');
      editor.updateContent(id, 'modified');
      mockMessage.mockResolvedValue('Cancel');

      await closeTabWithConfirm(id, tr);

      // Tab should still exist
      const tabs = get(editor.tabs);
      expect(tabs.find(t => t.id === id)).toBeDefined();
    });

    it('saves before closing when user clicks Yes', async () => {
      const id = editor.addTab('/test.md', 'test.md', 'original');
      editor.updateContent(id, 'modified');
      mockMessage.mockResolvedValue('Yes');
      mockInvoke.mockResolvedValue(undefined);

      await closeTabWithConfirm(id, tr);

      expect(mockInvoke).toHaveBeenCalledWith('write_file', {
        path: '/test.md',
        content: 'modified',
      });
      // Tab should be closed after save
      const tabs = get(editor.tabs);
      expect(tabs.find(t => t.id === id)).toBeUndefined();
    });

    it('does not close tab if save fails on Yes', async () => {
      const id = editor.addTab('/test.md', 'test.md', 'original');
      editor.updateContent(id, 'modified');
      mockMessage.mockResolvedValue('Yes');
      mockInvoke.mockRejectedValue(new Error('Save failed'));

      await closeTabWithConfirm(id, tr);

      // Tab should still exist because save failed
      const tabs = get(editor.tabs);
      expect(tabs.find(t => t.id === id)).toBeDefined();
    });
  });

  describe('openFileFromPath', () => {
    it('opens file and creates tab on happy path', async () => {
      mockInvoke.mockResolvedValue({
        path: '/home/user/readme.md',
        name: 'readme.md',
        content: '# README',
        size: 8,
      });

      await openFileFromPath('/home/user/readme.md', tr);

      expect(mockInvoke).toHaveBeenCalledWith('read_file', { path: '/home/user/readme.md' });
      const tabs = get(editor.tabs);
      const tab = tabs.find(t => t.name === 'readme.md');
      expect(tab).toBeDefined();
      expect(tab!.content).toBe('# README');
    });

    it('shows toast on file read error', async () => {
      mockInvoke.mockRejectedValue(new Error('File not found'));

      await openFileFromPath('/nonexistent.md', tr);

      expect(showToast).toHaveBeenCalledWith('error_open_file', 'error');
    });
  });
});
