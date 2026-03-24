import { preferences } from '$lib/stores/preferences';
import { muyaService } from './muya';

/**
 * Editor font size service — applies preferences.fontSize / lineHeight to the
 * Muya editor body only. Does NOT affect the rest of the UI (sidebar, status
 * bar, modals) — the app zoom service handles global scaling.
 *
 * IMPORTANT: muya.setFont() only updates Muya's internal options object; it
 * does not touch the DOM. The visible font size used to come from the
 * `--font-size` CSS variable applied to body, which scaled the whole UI.
 * After the zoom redesign, that variable is static, so this service applies
 * font-size and line-height directly as inline styles on the Muya container.
 * That keeps the effect scoped to the editor only.
 */
class FontSizeService {
	private unsub: (() => void) | null = null;

	init(): void {
		this.unsub = preferences.subscribe((p) => {
			const fontSize = p.fontSize || 16;
			const lineHeight = p.lineHeight || 1.6;

			if (muyaService.isReady()) {
				muyaService.setFont({ fontSize, lineHeight });
				const muya = muyaService.getInstance();
				if (muya?.container) {
					muya.container.style.fontSize = `${fontSize}px`;
					muya.container.style.lineHeight = `${lineHeight}`;
				}
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
