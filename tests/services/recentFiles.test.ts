import { describe, it, expect } from 'vitest';
import { computeRecentFiles } from '$lib/services/recentFiles';

describe('computeRecentFiles', () => {
	it('prepends a new path to an empty list', () => {
		expect(computeRecentFiles([], '/a.md')).toEqual(['/a.md']);
	});

	it('prepends a new path to existing list', () => {
		expect(computeRecentFiles(['/b.md', '/c.md'], '/a.md')).toEqual(['/a.md', '/b.md', '/c.md']);
	});

	it('dedupes: existing path is moved to the top, not duplicated', () => {
		expect(computeRecentFiles(['/a.md', '/b.md', '/c.md'], '/b.md')).toEqual(['/b.md', '/a.md', '/c.md']);
	});

	it('truncates to default max (10)', () => {
		const ten = Array.from({ length: 10 }, (_, i) => `/f${i}.md`);
		const r = computeRecentFiles(ten, '/new.md');
		expect(r).toHaveLength(10);
		expect(r[0]).toBe('/new.md');
		expect(r).not.toContain('/f9.md');
	});

	it('respects custom max', () => {
		const r = computeRecentFiles(['/a.md', '/b.md', '/c.md'], '/d.md', 2);
		expect(r).toEqual(['/d.md', '/a.md']);
	});

	it('moving existing path to top does not change length', () => {
		const r = computeRecentFiles(['/a.md', '/b.md'], '/b.md');
		expect(r).toHaveLength(2);
	});
});
