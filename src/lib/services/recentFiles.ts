import { preferences } from '$lib/stores/preferences';
import { get } from 'svelte/store';

const MAX_RECENT = 10;

/** Pure helper: produit la nouvelle liste après push d'un path, dédupé et tronqué.
 * Le path push remonte en tête. Extrait pour la testabilité. */
export function computeRecentFiles(current: readonly string[], path: string, max = MAX_RECENT): string[] {
	return [path, ...current.filter((p) => p !== path)].slice(0, max);
}

export function pushRecentFile(path: string): void {
	const current = get(preferences).recentFiles ?? [];
	const next = computeRecentFiles(current, path);
	if (next.length === current.length && next.every((p, i) => p === current[i])) return;
	preferences.patch({ recentFiles: next });
}
