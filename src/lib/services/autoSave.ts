import { DEFAULT_AUTO_SAVE_DELAY } from '$lib/constants';
import { dlog } from '$lib/services/debug';
import type { Preferences } from '$lib/stores/preferences';

/** Result of a single auto-save attempt as reported by the callback. */
export type SaveOutcome =
	| 'saved' // disk write succeeded
	| 'unchanged' // nothing to save (e.g. no active tab, no path, !isModified)
	| 'failed'; // disk write rejected — triggers backoff

/** Backoff window in ms for the Nth consecutive failure (capped at 60 s). */
export function backoffMs(consecutiveFailures: number): number {
	if (consecutiveFailures <= 0) return 0;
	return Math.min(60_000, 1_000 * 2 ** (consecutiveFailures - 1));
}

/**
 * Starts auto-save logic that polls the preferences each tick.
 *
 * The callback should:
 *   - return `'saved'` when a write actually hit disk;
 *   - return `'unchanged'` to indicate the tick should be skipped (no-op,
 *     e.g. nothing modified, or no path → would prompt a dialog);
 *   - return `'failed'` (or throw) when a write was attempted but rejected.
 *
 * On `'failed'`, the next attempt is suppressed for `backoffMs(N)` where N
 * is the number of consecutive failures since the last success. The backoff
 * resets on `'saved'` (not on `'unchanged'`, since unchanged ticks are
 * not actual attempts).
 *
 * Returns a cleanup function to clear the interval.
 */
export function startAutoSave(
	getPrefs: () => Preferences,
	saveCallback: () => Promise<SaveOutcome> | SaveOutcome,
): () => void {
	let intervalId: number | null = null;
	let currentDelay: number = DEFAULT_AUTO_SAVE_DELAY;
	let enabled = false;
	let consecutiveFailures = 0;
	let nextAttemptAt = 0;

	async function tick(): Promise<void> {
		const now = Date.now();
		if (now < nextAttemptAt) {
			dlog('save', `autoSave tick suppressed (backoff until ${nextAttemptAt - now}ms)`);
			return;
		}
		try {
			const outcome = await Promise.resolve(saveCallback());
			if (outcome === 'saved') {
				if (consecutiveFailures > 0) {
					dlog('save', `autoSave recovered after ${consecutiveFailures} failure(s)`);
				}
				consecutiveFailures = 0;
				nextAttemptAt = 0;
			} else if (outcome === 'failed') {
				consecutiveFailures += 1;
				const wait = backoffMs(consecutiveFailures);
				nextAttemptAt = Date.now() + wait;
				dlog('save', `autoSave failed (#${consecutiveFailures}), backoff ${wait}ms`);
			} else {
				dlog('save', 'autoSave tick: unchanged');
			}
		} catch (e) {
			consecutiveFailures += 1;
			const wait = backoffMs(consecutiveFailures);
			nextAttemptAt = Date.now() + wait;
			dlog('save', `autoSave threw (#${consecutiveFailures}), backoff ${wait}ms`, e);
		}
	}

	function restart(): void {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}

		const prefs = getPrefs();
		enabled = prefs.autoSave;
		currentDelay = prefs.autoSaveDelay || DEFAULT_AUTO_SAVE_DELAY;

		if (enabled) {
			dlog('save', `autoSave enabled, delay ${currentDelay}ms`);
			intervalId = window.setInterval(() => {
				const p = getPrefs();
				if (!p.autoSave) {
					restart();
					return;
				}
				const newDelay = p.autoSaveDelay || DEFAULT_AUTO_SAVE_DELAY;
				if (newDelay !== currentDelay) {
					restart();
					return;
				}
				void tick();
			}, currentDelay);
		} else {
			dlog('save', 'autoSave disabled');
			// Reset backoff state when disabling so re-enabling starts clean.
			consecutiveFailures = 0;
			nextAttemptAt = 0;
		}
	}

	restart();

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
