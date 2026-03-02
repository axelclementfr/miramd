import { preferences } from '$lib/stores/preferences';
import { muyaService } from './muya';

/**
 * Editor font size service — applies preferences.fontSize / lineHeight /
 * fontFamily / editorLineWidth to the Muya editor body only. Does NOT
 * affect the rest of the UI (sidebar, status bar, modals, etc.) — the app
 * zoom service handles global scaling.
 *
 * Was previously bundled with zoom.ts and multiplied fontSize by the zoom
 * factor; that coupling is gone.
 */
class FontSizeService {
  private unsub: (() => void) | null = null;

  init(): void {
    this.unsub = preferences.subscribe((p) => {
      if (muyaService.isReady()) {
        muyaService.setFont({
          fontSize: p.fontSize || 16,
          lineHeight: p.lineHeight || 1.6,
        });
      }

      if (p.editorLineWidth) {
        document.documentElement.style.setProperty('--editorAreaWidth', p.editorLineWidth);
      } else {
        document.documentElement.style.removeProperty('--editorAreaWidth');
      }
    });
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = null;
  }
}

export const fontSizeService = new FontSizeService();
