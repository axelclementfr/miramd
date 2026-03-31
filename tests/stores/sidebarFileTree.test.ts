import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { openedProjects, openedFilesCollapsed } from '$lib/stores/sidebarFileTree';

describe('sidebarFileTree stores', () => {
	beforeEach(() => {
		openedProjects.set([]);
		openedFilesCollapsed.set(false);
	});

	describe('openedProjects', () => {
		it('starts empty', () => {
			expect(get(openedProjects)).toEqual([]);
		});

		it('persists a project list set via .set()', () => {
			openedProjects.set([{ dir: '/a', name: 'a', files: [], folders: [], collapsed: false }]);
			expect(get(openedProjects)).toEqual([{ dir: '/a', name: 'a', files: [], folders: [], collapsed: false }]);
		});

		it('notifies subscribers on update', () => {
			const seen: number[] = [];
			const unsub = openedProjects.subscribe((v) => seen.push(v.length));
			openedProjects.set([{ dir: '/a', name: 'a', files: [], folders: [], collapsed: false }]);
			openedProjects.set([
				{ dir: '/a', name: 'a', files: [], folders: [], collapsed: false },
				{ dir: '/b', name: 'b', files: [], folders: [], collapsed: false },
			]);
			unsub();
			expect(seen).toEqual([0, 1, 2]);
		});
	});

	describe('openedFilesCollapsed', () => {
		it('starts false (section visible by default)', () => {
			expect(get(openedFilesCollapsed)).toBe(false);
		});

		it('can be toggled', () => {
			openedFilesCollapsed.set(true);
			expect(get(openedFilesCollapsed)).toBe(true);
			openedFilesCollapsed.set(false);
			expect(get(openedFilesCollapsed)).toBe(false);
		});
	});
});
