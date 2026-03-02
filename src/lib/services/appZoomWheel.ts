import { get } from 'svelte/store';
import { preferences } from '$lib/stores/preferences';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP_WHEEL } from '$lib/constants';

/**
 * Global Ctrl+wheel zoom listener. When the user holds Ctrl (or Cmd on Mac)
 * and scrolls the wheel, the app zoom level is adjusted in fine increments.
 * Mirrors the behavior of MarkText and most browsers.
 *
 * The actual zoom application happens via zoomService (which reacts to the
 * preferences.zoom store). This service only translates wheel events into
 * preference patches.
 */
export function initAppZoomWheel(): () => void {
  function onWheel(e: WheelEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP_WHEEL : ZOOM_STEP_WHEEL;
    const current = get(preferences).zoom ?? 1.0;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, round2(current + delta)));
    if (next !== current) preferences.patch({ zoom: next });
  }
  window.addEventListener('wheel', onWheel, { passive: false, capture: true });
  return () => window.removeEventListener('wheel', onWheel, { capture: true } as EventListenerOptions);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
