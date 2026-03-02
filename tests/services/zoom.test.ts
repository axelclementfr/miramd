import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

// Mock muyaService
const mockSetFont = vi.fn();
const mockIsReady = vi.fn().mockReturnValue(false);
vi.mock('$lib/services/muya', () => ({
  muyaService: {
    isReady: (...args: any[]) => mockIsReady(...args),
    setFont: (...args: any[]) => mockSetFont(...args),
  },
}));

const { preferences } = await import('$lib/stores/preferences');
const { zoomService } = await import('$lib/services/zoom');

describe('ZoomService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferences.patch({ fontSize: 16, zoom: 1.0, lineHeight: 1.6, editorLineWidth: '' });
  });

  afterEach(() => {
    zoomService.destroy();
  });

  describe('init', () => {
    it('subscribes to preferences and calls setFont when muya is ready', () => {
      mockIsReady.mockReturnValue(true);
      zoomService.init();

      // Subscription fires immediately with current prefs
      expect(mockSetFont).toHaveBeenCalledWith({
        fontSize: 16,
        lineHeight: 1.6,
      });
    });

    it('does not call setFont when muya is not ready', () => {
      mockIsReady.mockReturnValue(false);
      zoomService.init();

      expect(mockSetFont).not.toHaveBeenCalled();
    });

    it('applies zoom factor to font size', () => {
      mockIsReady.mockReturnValue(true);
      preferences.patch({ fontSize: 16, zoom: 1.5 });
      zoomService.init();

      expect(mockSetFont).toHaveBeenCalledWith({
        fontSize: 24, // Math.round(16 * 1.5)
        lineHeight: 1.6,
      });
    });

    it('applies editorLineWidth as CSS variable', () => {
      preferences.patch({ editorLineWidth: '800px' });
      zoomService.init();

      expect(document.documentElement.style.getPropertyValue('--editorAreaWidth')).toBe('800px');
    });

    it('removes CSS variable when editorLineWidth is empty', () => {
      document.documentElement.style.setProperty('--editorAreaWidth', '600px');
      preferences.patch({ editorLineWidth: '' });
      zoomService.init();

      expect(document.documentElement.style.getPropertyValue('--editorAreaWidth')).toBe('');
    });
  });

  describe('destroy', () => {
    it('unsubscribes from preferences', () => {
      mockIsReady.mockReturnValue(true);
      zoomService.init();
      vi.clearAllMocks();

      zoomService.destroy();

      // After destroy, changing prefs should not trigger setFont
      preferences.patch({ fontSize: 20 });
      expect(mockSetFont).not.toHaveBeenCalled();
    });
  });

  describe('zoom calculations', () => {
    it('rounds font size correctly', () => {
      mockIsReady.mockReturnValue(true);
      preferences.patch({ fontSize: 15, zoom: 1.3 });
      zoomService.init();

      // Math.round(15 * 1.3) = Math.round(19.5) = 20
      expect(mockSetFont).toHaveBeenCalledWith({
        fontSize: 20,
        lineHeight: 1.6,
      });
    });

    it('uses default values when prefs are falsy', () => {
      mockIsReady.mockReturnValue(true);
      preferences.patch({ fontSize: 0, zoom: 0, lineHeight: 0 });
      zoomService.init();

      // Defaults: fontSize=16, zoom=1.0, lineHeight=1.6
      expect(mockSetFont).toHaveBeenCalledWith({
        fontSize: 16, // Math.round(16 * 1.0)
        lineHeight: 1.6,
      });
    });
  });
});
