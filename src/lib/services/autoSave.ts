import { DEFAULT_AUTO_SAVE_DELAY } from '$lib/constants';
import type { Preferences } from '$lib/stores/preferences';

/**
 * Starts auto-save logic that checks preferences each tick.
 * Returns a cleanup function to clear the interval.
 */
export function startAutoSave(getPrefs: () => Preferences, saveCallback: () => void): () => void {
	let intervalId: number | null = null;
	let currentDelay: number = DEFAULT_AUTO_SAVE_DELAY;
	let enabled = false;

	function restart(): void {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}

		const prefs = getPrefs();
		enabled = prefs.autoSave;
		currentDelay = prefs.autoSaveDelay || DEFAULT_AUTO_SAVE_DELAY;

		if (enabled) {
			intervalId = window.setInterval(() => {
				// Re-check in case autoSave was disabled between ticks
				const p = getPrefs();
				if (!p.autoSave) {
					restart();
					return;
				}
				// Restart if delay changed
				const newDelay = p.autoSaveDelay || DEFAULT_AUTO_SAVE_DELAY;
				if (newDelay !== currentDelay) {
					restart();
					return;
				}
				saveCallback();
			}, currentDelay);
		}
	}

	restart();

	// Periodically check for preference changes (every 2s instead of 1s)
	const checkInterval = window.setInterval(() => {
		const prefs = getPrefs();
		const newEnabled = prefs.autoSave;
		const newDelay = prefs.autoSaveDelay || DEFAULT_AUTO_SAVE_DELAY;
		if (newEnabled !== enabled || newDelay !== currentDelay) {
			restart();
		}
	}, 2000);

	return () => {
		if (intervalId !== null) clearInterval(intervalId);
		clearInterval(checkInterval);
	};
}
