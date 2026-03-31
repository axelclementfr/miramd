import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { uiActions } from '$lib/stores/uiActions';

describe('uiActions store', () => {
	beforeEach(() => {
		uiActions.set({});
	});

	it('starts empty', () => {
		expect(get(uiActions)).toEqual({});
	});

	it('registers an action via update()', () => {
		const fn = () => {};
		uiActions.update((a) => ({ ...a, openFolder: fn }));
		expect(get(uiActions).openFolder).toBe(fn);
	});

	it('unregistering preserves other keys (none here, but pattern works)', () => {
		uiActions.update((a) => ({ ...a, openFolder: () => {} }));
		uiActions.update((a) => ({ ...a, openFolder: undefined }));
		expect(get(uiActions).openFolder).toBeUndefined();
	});

	it('notifies subscribers when an action is registered', () => {
		const seen: boolean[] = [];
		const unsub = uiActions.subscribe((a) => seen.push(typeof a.openFolder === 'function'));
		uiActions.update((a) => ({ ...a, openFolder: async () => {} }));
		uiActions.update((a) => ({ ...a, openFolder: undefined }));
		unsub();
		expect(seen).toEqual([false, true, false]);
	});
});
