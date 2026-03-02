import { preferences } from '$lib/stores/preferences';
import { muyaService } from './muya';

/**
 * Zoom service — scales Muya editor font size based on preferences.zoom.
 * Uses Muya's setFont() API, NOT CSS zoom (which breaks WebKitGTK layout).
 * Singleton with init/destroy lifecycle.
 */
class ZoomService {
  private unsub: (() => void) | null = null;

  /** Subscribes to preferences and applies zoom/font changes to the Muya editor. */
  init(): void {
    this.unsub = preferences.subscribe((p) => {
      const baseSize = p.fontSize || 16;
      const zoom = p.zoom || 1.0;
      const lineHeight = p.lineHeight || 1.6;

      if (muyaService.isReady()) {
        muyaService.setFont({
          fontSize: Math.round(baseSize * zoom),
          lineHeight,
        });
      }

      // Also apply editorLineWidth as CSS variable
      if (p.editorLineWidth) {
        document.documentElement.style.setProperty('--editorAreaWidth', p.editorLineWidth);
      } else {
        document.documentElement.style.removeProperty('--editorAreaWidth');
      }
    });
  }

  /** Unsubscribes from preferences updates. */
  destroy(): void {
    this.unsub?.();
    this.unsub = null;
  }
}

export const zoomService = new ZoomService();
