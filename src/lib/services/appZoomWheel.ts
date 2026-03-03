import { get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { preferences } from '$lib/stores/preferences';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP_WHEEL } from '$lib/constants';

/**
 * Global Ctrl+wheel zoom listener. Mirrors MarkText / browsers: hold Ctrl
 * (or Cmd) and scroll → app zoom in fine increments.
 *
 * Performance: each wheel tick applies the zoom DIRECTLY via the Tauri
 * `set_app_zoom` IPC for instant visual feedback, bypassing the preferences
 * store. The store and disk persistence are only updated after the user
 * stops scrolling (200 ms idle). This avoids saturating the IPC bridge with
 * `save_preferences` calls — each one re-serializes the whole prefs object
 * and was the source of the laggy feel.
 *
 * Status-bar indicator catches up at the end of the scroll. The trade-off
 * is intentional and documented.
 */
export function initAppZoomWheel(): () => void {
  let cachedZoom = get(preferences).zoom ?? 1.0;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // Keep cache in sync with external preference changes (slider, status bar).
  const unsubPrefs = preferences.subscribe((p) => {
    cachedZoom = p.zoom ?? 1.0;
  });

  function onWheel(e: WheelEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP_WHEEL : ZOOM_STEP_WHEEL;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, round2(cachedZoom + delta)));
    if (next === cachedZoom) return;
    cachedZoom = next;
    invoke('set_app_zoom', { scale: next }).catch((err) => {
      console.warn('[appZoomWheel] set_app_zoom failed:', err);
    });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      preferences.patch({ zoom: cachedZoom });
      saveTimer = null;
    }, 200);
  }

  window.addEventListener('wheel', onWheel, { passive: false, capture: true });
  return () => {
    window.removeEventListener('wheel', onWheel, { capture: true } as EventListenerOptions);
    unsubPrefs();
    if (saveTimer) clearTimeout(saveTimer);
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
