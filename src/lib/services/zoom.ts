import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM } from '$lib/constants';
import { preferences } from '$lib/stores/preferences';
import { invoke } from '@tauri-apps/api/core';

/**
 * App zoom service — controls the WebKit-level zoom factor of the entire
 * window via Tauri's WebviewWindow::set_zoom. Independent of editor font size.
 *
 * Source of truth: preferences.zoom. This service subscribes and forwards
 * every change to the Rust backend, which calls webkit_web_view_set_zoom_level
 * under the hood. Effect: text, icons, paddings, scrollbars and images all
 * scale uniformly — same behavior as Ctrl+= in a browser.
 */
class ZoomService {
	private unsub: (() => void) | null = null;
	private lastApplied: number | null = null;

	init(): void {
		this.unsub = preferences.subscribe((p) => {
			const scale = clamp(p.zoom ?? DEFAULT_ZOOM);
			if (scale === this.lastApplied) return;
			this.lastApplied = scale;
			invoke('set_app_zoom', { scale }).catch((e) => {
				console.warn('[zoom] set_app_zoom failed:', e);
			});
		});
	}

	destroy(): void {
		this.unsub?.();
		this.unsub = null;
		this.lastApplied = null;
	}
}

function clamp(scale: number): number {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

export const zoomService = new ZoomService();
