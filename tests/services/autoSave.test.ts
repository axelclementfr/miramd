import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backoffMs, startAutoSave, type SaveOutcome } from '$lib/services/autoSave';
import type { Preferences } from '$lib/stores/preferences';

const basePrefs = (): Preferences =>
	({
		autoSave: true,
		autoSaveDelay: 1000,
	}) as Preferences;

describe('backoffMs', () => {
	it('returns 0 for no failures', () => {
		expect(backoffMs(0)).toBe(0);
	});

	it('starts at 1 s for the first failure and doubles each time', () => {
		expect(backoffMs(1)).toBe(1_000);
		expect(backoffMs(2)).toBe(2_000);
		expect(backoffMs(3)).toBe(4_000);
		expect(backoffMs(4)).toBe(8_000);
		expect(backoffMs(5)).toBe(16_000);
		expect(backoffMs(6)).toBe(32_000);
	});

	it('caps at 60 s no matter how many failures', () => {
		expect(backoffMs(7)).toBe(60_000);
		expect(backoffMs(20)).toBe(60_000);
	});

	it('treats negative inputs as no failures', () => {
		expect(backoffMs(-1)).toBe(0);
	});
});

describe('startAutoSave', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('does not call the callback while autoSave is disabled', async () => {
		const cb = vi.fn<() => SaveOutcome>(() => 'unchanged');
		const stop = startAutoSave(() => ({ ...basePrefs(), autoSave: false }) as Preferences, cb);
		await vi.advanceTimersByTimeAsync(5000);
		expect(cb).not.toHaveBeenCalled();
		stop();
	});

	it('calls the callback every autoSaveDelay ms when enabled', async () => {
		const cb = vi.fn<() => SaveOutcome>(() => 'unchanged');
		const stop = startAutoSave(() => basePrefs(), cb);
		await vi.advanceTimersByTimeAsync(1000);
		expect(cb).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(cb).toHaveBeenCalledTimes(2);
		stop();
	});

	it('suppresses ticks during the backoff window after a failure', async () => {
		const cb = vi.fn<() => Promise<SaveOutcome>>(async () => 'failed');
		const stop = startAutoSave(() => basePrefs(), cb);

		// First tick: fires, fails, sets backoff to 1 s from now.
		await vi.advanceTimersByTimeAsync(1000);
		expect(cb).toHaveBeenCalledTimes(1);

		// Next tick (t=2 s) is within backoff (until t=2 s exactly) — still suppressed at t=1.999 s
		await vi.advanceTimersByTimeAsync(999);
		expect(cb).toHaveBeenCalledTimes(1);

		// At t=3 s, the next tick fires; backoff has expired.
		await vi.advanceTimersByTimeAsync(1001);
		expect(cb).toHaveBeenCalledTimes(2);

		stop();
	});

	it('grows the backoff exponentially on consecutive failures', async () => {
		// All outcomes are 'failed'. Interval = 1 s.
		// Timeline (t in seconds, ticks at every integer):
		//   t=1: fires → fail #1, backoff to t=2
		//   t=2: 2<2 false → fires → fail #2, backoff to t=4
		//   t=3: 3<4 true → suppressed
		//   t=4: 4<4 false → fires → fail #3, backoff to t=8
		//   t=5..7: suppressed
		//   t=8: fires → fail #4, backoff to t=16
		const cb = vi.fn<() => Promise<SaveOutcome>>(async () => 'failed');
		const stop = startAutoSave(() => basePrefs(), cb);

		await vi.advanceTimersByTimeAsync(1000); // t=1
		expect(cb).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000); // t=2
		expect(cb).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1000); // t=3 suppressed
		expect(cb).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1000); // t=4 fires
		expect(cb).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(3000); // t=5,6,7 all suppressed
		expect(cb).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(1000); // t=8 fires
		expect(cb).toHaveBeenCalledTimes(4);

		stop();
	});

	it('resets the backoff after a successful save', async () => {
		// Timeline:
		//   t=1: fail #1, backoff to t=2
		//   t=2: fires → fail #2, backoff to t=4
		//   t=3: suppressed
		//   t=4: fires → 'saved' → reset (consec=0, nextAttemptAt=0)
		//   t=5: fires → 'failed' (queue empty after this) → fail #1 (fresh), backoff to t=6
		//   t=6: fires → 'unchanged' (queue empty)
		const queue: SaveOutcome[] = ['failed', 'failed', 'saved', 'failed'];
		const cb = vi.fn<() => Promise<SaveOutcome>>(async () => queue.shift() ?? 'unchanged');
		const stop = startAutoSave(() => basePrefs(), cb);

		await vi.advanceTimersByTimeAsync(1000); // t=1
		expect(cb).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000); // t=2
		expect(cb).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1000); // t=3 suppressed
		expect(cb).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1000); // t=4 'saved' resets
		expect(cb).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(1000); // t=5 'failed' fresh consec=1
		expect(cb).toHaveBeenCalledTimes(4);
		await vi.advanceTimersByTimeAsync(1000); // t=6 fires (backoff was 1s post-reset)
		expect(cb).toHaveBeenCalledTimes(5);

		stop();
	});

	it('does not reset the backoff on unchanged outcomes', async () => {
		// Proves consec stays at 1 after 'unchanged' by observing that the
		// next 'failed' applies a 2 s backoff (consec=2) instead of 1 s.
		// Timeline:
		//   t=1: 'failed' → consec=1, backoff to t=2
		//   t=2: fires → 'unchanged' (consec stays 1, nextAttemptAt stays 2)
		//   t=3: 3<2 false → fires → 'failed' → consec=2, backoff to t=5
		//   t=4: 4<5 true → suppressed
		//   t=5: 5<5 false → fires (queue empty → 'unchanged')
		const queue: SaveOutcome[] = ['failed', 'unchanged', 'failed'];
		const cb = vi.fn<() => Promise<SaveOutcome>>(async () => queue.shift() ?? 'unchanged');
		const stop = startAutoSave(() => basePrefs(), cb);

		await vi.advanceTimersByTimeAsync(1000); // t=1
		expect(cb).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000); // t=2 'unchanged'
		expect(cb).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1000); // t=3 'failed' (consec becomes 2)
		expect(cb).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(1000); // t=4 suppressed (proves backoff was 2 s)
		expect(cb).toHaveBeenCalledTimes(3);
		await vi.advanceTimersByTimeAsync(1000); // t=5 fires
		expect(cb).toHaveBeenCalledTimes(4);

		stop();
	});

	it('treats a thrown callback as a failure', async () => {
		const cb = vi.fn<() => Promise<SaveOutcome>>(async () => {
			throw new Error('boom');
		});
		const stop = startAutoSave(() => basePrefs(), cb);

		await vi.advanceTimersByTimeAsync(1000); // throw → fail #1
		await vi.advanceTimersByTimeAsync(999); // within backoff
		expect(cb).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1001); // backoff expired, fires
		expect(cb).toHaveBeenCalledTimes(2);

		stop();
	});

	it('cleanup removes the interval', async () => {
		const cb = vi.fn<() => SaveOutcome>(() => 'unchanged');
		const stop = startAutoSave(() => basePrefs(), cb);
		await vi.advanceTimersByTimeAsync(1000);
		expect(cb).toHaveBeenCalledTimes(1);
		stop();
		await vi.advanceTimersByTimeAsync(5000);
		expect(cb).toHaveBeenCalledTimes(1);
	});
});
