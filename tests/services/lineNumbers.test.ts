import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

const { preferences } = await import('$lib/stores/preferences');
const { lineNumbersService } = await import('$lib/services/lineNumbers');

describe('LineNumbersService', () => {
  let paneElement: HTMLElement;

  beforeEach(() => {
    paneElement = document.createElement('div');
    paneElement.classList.add('wysiwyg-pane');
    document.body.appendChild(paneElement);
    preferences.patch({ editorLineNumbers: false });
  });

  afterEach(() => {
    lineNumbersService.destroy();
    document.body.removeChild(paneElement);
  });

  describe('init', () => {
    it('adds show-line-numbers class when enabled', () => {
      preferences.patch({ editorLineNumbers: true });
      lineNumbersService.init(paneElement);

      expect(paneElement.classList.contains('show-line-numbers')).toBe(true);
    });

    it('does not add class when disabled', () => {
      preferences.patch({ editorLineNumbers: false });
      lineNumbersService.init(paneElement);

      expect(paneElement.classList.contains('show-line-numbers')).toBe(false);
    });

    it('toggles class when preference changes', () => {
      lineNumbersService.init(paneElement);
      expect(paneElement.classList.contains('show-line-numbers')).toBe(false);

      preferences.patch({ editorLineNumbers: true });
      expect(paneElement.classList.contains('show-line-numbers')).toBe(true);

      preferences.patch({ editorLineNumbers: false });
      expect(paneElement.classList.contains('show-line-numbers')).toBe(false);
    });
  });

  describe('destroy', () => {
    it('unsubscribes from preferences', () => {
      lineNumbersService.init(paneElement);
      lineNumbersService.destroy();

      // After destroy, changing prefs should not toggle the class
      preferences.patch({ editorLineNumbers: true });
      expect(paneElement.classList.contains('show-line-numbers')).toBe(false);
    });
  });
});
