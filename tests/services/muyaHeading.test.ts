import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue({}) }));

const updateParagraph = vi.fn();

const { muyaService } = await import('$lib/services/muya');

beforeEach(() => {
  updateParagraph.mockClear();
  // The service holds a private muya field; we install a fake instance via init
  // is not possible because that path requires window.Muya. Instead, we cast to
  // any and replace the private field directly. This mirrors how the heading
  // shift methods access updateParagraph in production.
  (muyaService as unknown as { muya: unknown }).muya = { updateParagraph };
});

describe('muyaService heading shifts', () => {
  it('shiftHeadingUp delegates to updateParagraph("upgrade heading")', () => {
    muyaService.shiftHeadingUp();
    expect(updateParagraph).toHaveBeenCalledWith('upgrade heading');
  });

  it('shiftHeadingDown delegates to updateParagraph("degrade heading")', () => {
    muyaService.shiftHeadingDown();
    expect(updateParagraph).toHaveBeenCalledWith('degrade heading');
  });

  it('resetToParagraph delegates to updateParagraph("paragraph")', () => {
    muyaService.resetToParagraph();
    expect(updateParagraph).toHaveBeenCalledWith('paragraph');
  });

  it('shiftHeadingUp is a no-op when Muya is not initialized', () => {
    (muyaService as unknown as { muya: null }).muya = null;
    expect(() => muyaService.shiftHeadingUp()).not.toThrow();
    expect(updateParagraph).not.toHaveBeenCalled();
  });

  it('swallows errors thrown by Muya', () => {
    updateParagraph.mockImplementationOnce(() => { throw new Error('Muya internal'); });
    expect(() => muyaService.shiftHeadingUp()).not.toThrow();
  });
});
