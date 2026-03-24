import { writable } from 'svelte/store';

export type DebugSubject =
	| 'typewriter'
	| 'ctrlz'
	| 'save'
	| 'muya'
	| 'zoom'
	| 'editorModes'
	| 'prefs'
	| 'sound'
	| 'toc';

export const ALL_SUBJECTS: readonly DebugSubject[] = [
	'typewriter',
	'ctrlz',
	'save',
	'muya',
	'zoom',
	'editorModes',
	'prefs',
	'sound',
	'toc',
] as const;

export type DebugFlags = Record<DebugSubject, boolean>;

const STORAGE_KEY = 'miramd_debug';

function emptyFlags(): DebugFlags {
	const out = {} as DebugFlags;
	for (const s of ALL_SUBJECTS) out[s] = false;
	return out;
}

function hydrateFromStorage(): DebugFlags {
	const flags = emptyFlags();
	if (typeof localStorage === 'undefined') return flags;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return flags;
		const known = new Set<DebugSubject>(ALL_SUBJECTS);
		for (const part of raw.split(',')) {
			const name = part.trim();
			if (name && known.has(name as DebugSubject)) {
				flags[name as DebugSubject] = true;
			}
		}
		return flags;
	} catch (err) {
		console.warn('[debug] hydrate failed:', err);
		return flags;
	}
}

export const debugFlags = writable<DebugFlags>(hydrateFromStorage());

export function persistFlags(flags: DebugFlags): void {
	if (typeof localStorage === 'undefined') return;
	try {
		const active = ALL_SUBJECTS.filter((s) => flags[s]);
		if (active.length === 0) {
			localStorage.removeItem(STORAGE_KEY);
		} else {
			localStorage.setItem(STORAGE_KEY, active.join(','));
		}
	} catch (err) {
		console.warn('[debug] persist failed:', err);
	}
}
