import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSetFont = vi.fn();
const mockIsReady = vi.fn().mockReturnValue(false);
vi.mock('$lib/services/muya', () => ({
  muyaService: {
    isReady: (...args: any[]) => mockIsReady(...args),
    setFont: (...args: any[]) => mockSetFont(...args),
  },
}));

const { preferences } = await import('$lib/stores/preferences');
const { fontSizeService } = await import('$lib/services/fontSize');

describe('FontSizeService (editor only, no zoom multiplier)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferences.patch({ fontSize: 16, lineHeight: 1.6, editorLineWidth: '' });
    document.documentElement.style.removeProperty('--editorAreaWidth');
  });

  afterEach(() => {
    fontSizeService.destroy();
  });

  it('passes fontSize directly to Muya without any zoom multiplication', () => {
    mockIsReady.mockReturnValue(true);
    preferences.patch({ fontSize: 18, lineHeight: 1.5, zoom: 1.5 });
    fontSizeService.init();

    expect(mockSetFont).toHaveBeenCalledWith({ fontSize: 18, lineHeight: 1.5 });
    expect(mockSetFont).not.toHaveBeenCalledWith(expect.objectContaining({ fontSize: 27 }));
  });

  it('does not call setFont when Muya is not ready', () => {
    mockIsReady.mockReturnValue(false);
    fontSizeService.init();

    expect(mockSetFont).not.toHaveBeenCalled();
  });

  it('uses defaults (fontSize=16, lineHeight=1.6) when prefs are falsy', () => {
    mockIsReady.mockReturnValue(true);
    preferences.patch({ fontSize: 0, lineHeight: 0 });
    fontSizeService.init();

    expect(mockSetFont).toHaveBeenCalledWith({ fontSize: 16, lineHeight: 1.6 });
  });

  it('applies editorLineWidth as the --editorAreaWidth CSS variable', () => {
    preferences.patch({ editorLineWidth: '800px' });
    fontSizeService.init();

    expect(document.documentElement.style.getPropertyValue('--editorAreaWidth')).toBe('800px');
  });

  it('removes --editorAreaWidth when editorLineWidth becomes empty', () => {
    document.documentElement.style.setProperty('--editorAreaWidth', '600px');
    preferences.patch({ editorLineWidth: '' });
    fontSizeService.init();

    expect(document.documentElement.style.getPropertyValue('--editorAreaWidth')).toBe('');
  });

  it('stops applying changes after destroy', () => {
    mockIsReady.mockReturnValue(true);
    fontSizeService.init();
    fontSizeService.destroy();
    mockSetFont.mockClear();

    preferences.patch({ fontSize: 22 });
    expect(mockSetFont).not.toHaveBeenCalled();
  });
});
