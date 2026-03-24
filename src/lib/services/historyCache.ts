/**
 * Per-tab Muya history cache.
 * Saves/restores undo/redo history when switching between tabs.
 * Muya owns undo/redo — we just persist it across tab switches.
 */

const cache = new Map<string, unknown>();

export const historyCache = {
	/** Retrieves the cached undo/redo history for a given tab. */
	get(tabId: string): unknown | undefined {
		return cache.get(tabId);
	},

	/** Stores the undo/redo history for a given tab. */
	set(tabId: string, history: unknown) {
		cache.set(tabId, history);
	},

	/** Removes the cached history for a closed tab. */
	delete(tabId: string) {
		cache.delete(tabId);
	},

	/** Remove entries for tabs that no longer exist. */
	cleanUp(activeTabIds: Set<string>) {
		for (const cachedId of cache.keys()) {
			if (!activeTabIds.has(cachedId)) cache.delete(cachedId);
		}
	},
};
