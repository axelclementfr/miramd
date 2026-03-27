import { describe, it, expect } from 'vitest';
import { escapeRegex, findMatchPositions, collectMatchRanges } from '$lib/services/findInDocument';

describe('escapeRegex', () => {
	it('escapes regex special chars', () => {
		expect(escapeRegex('a.b*c+d?')).toBe('a\\.b\\*c\\+d\\?');
		expect(escapeRegex('foo(bar)')).toBe('foo\\(bar\\)');
	});
	it('leaves plain text unchanged', () => {
		expect(escapeRegex('hello world')).toBe('hello world');
	});
});

describe('findMatchPositions', () => {
	it('returns empty for empty query', () => {
		expect(findMatchPositions('hello', '')).toEqual([]);
	});
	it('returns empty when no match', () => {
		expect(findMatchPositions('hello world', 'xyz')).toEqual([]);
	});
	it('finds a single match', () => {
		expect(findMatchPositions('hello world', 'world')).toEqual([{ start: 6, end: 11 }]);
	});
	it('finds multiple matches', () => {
		expect(findMatchPositions('foo foo foo', 'foo')).toEqual([
			{ start: 0, end: 3 },
			{ start: 4, end: 7 },
			{ start: 8, end: 11 },
		]);
	});
	it('is case-insensitive by default', () => {
		expect(findMatchPositions('Hello World HELLO', 'hello')).toEqual([
			{ start: 0, end: 5 },
			{ start: 12, end: 17 },
		]);
	});
	it('respects case-sensitive flag', () => {
		expect(findMatchPositions('Hello World HELLO', 'hello', true)).toEqual([]);
		expect(findMatchPositions('Hello World hello', 'hello', true)).toEqual([{ start: 12, end: 17 }]);
	});
	it('escapes regex special chars in query', () => {
		expect(findMatchPositions('a.b a.b ax b', 'a.b')).toEqual([
			{ start: 0, end: 3 },
			{ start: 4, end: 7 },
		]);
	});
});

describe('collectMatchRanges (DOM, no mutation)', () => {
	function setup(html: string): HTMLElement {
		const root = document.createElement('div');
		root.innerHTML = html;
		document.body.appendChild(root);
		return root;
	}
	function cleanup(root: HTMLElement) {
		root.remove();
	}

	it('returns empty for null root', () => {
		expect(collectMatchRanges(null, 'foo')).toEqual([]);
	});
	it('returns empty for empty query', () => {
		const root = setup('<p>hello world</p>');
		expect(collectMatchRanges(root, '')).toEqual([]);
		cleanup(root);
	});
	it('finds matches in a single text node', () => {
		const root = setup('<p>hello world hello</p>');
		const r = collectMatchRanges(root, 'hello');
		expect(r).toHaveLength(2);
		expect(r[0].toString()).toBe('hello');
		expect(r[1].toString()).toBe('hello');
		cleanup(root);
	});
	it('finds matches across multiple nested elements', () => {
		const root = setup('<p>foo <strong>bar</strong> foo</p>');
		const r = collectMatchRanges(root, 'foo');
		expect(r).toHaveLength(2);
		cleanup(root);
	});
	it('does NOT mutate the DOM (textContent stable before/after)', () => {
		const root = setup('<p>hello world hello</p>');
		const before = root.innerHTML;
		collectMatchRanges(root, 'hello');
		expect(root.innerHTML).toBe(before);
		cleanup(root);
	});
});
