import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
	open: vi.fn(),
	save: vi.fn(),
	message: vi.fn(),
}));

const { buildContextMenuItems } = await import('$lib/services/contextMenuItems');
const { preferences } = await import('$lib/stores/preferences');

const tr = (k: string) => k;

describe('buildContextMenuItems', () => {
	beforeEach(() => {
		preferences.patch({ recentFiles: [] });
	});

	it('returns the base menu without tab-specific entries when tabId is missing', () => {
		const items = buildContextMenuItems({ tr });
		const labels = items.map((i) => (i.type === 'item' || i.type === 'submenu' ? i.label : '---'));
		expect(labels).toEqual([
			'new_tab',
			'---',
			'open_file',
			'open_folder',
			'recent',
			'---',
			'save',
			'save_as',
		]);
	});

	it('appends Duplicate + Close tab entries when tabId is provided', () => {
		const items = buildContextMenuItems({ tr, tabId: 'abc-123' });
		const labels = items.map((i) => (i.type === 'item' || i.type === 'submenu' ? i.label : '---'));
		expect(labels.slice(-3)).toEqual(['---', 'duplicate', 'close_tab']);
	});

	it('Recent submenu shows disabled placeholder when no recent files', () => {
		const items = buildContextMenuItems({ tr });
		const recent = items.find((i) => i.type === 'submenu' && i.label === 'recent');
		expect(recent?.type).toBe('submenu');
		if (recent?.type !== 'submenu') return;
		expect(recent.children).toHaveLength(1);
		const first = recent.children[0];
		expect(first.type).toBe('item');
		if (first.type !== 'item') return;
		expect(first.label).toBe('no_recent_files');
		expect(first.disabled).toBe(true);
	});

	it('Recent submenu lists each file with basename as label', () => {
		preferences.patch({ recentFiles: ['/home/u/a.md', '/proj/b.md', '/c.md'] });
		const items = buildContextMenuItems({ tr });
		const recent = items.find((i) => i.type === 'submenu' && i.label === 'recent');
		if (recent?.type !== 'submenu') throw new Error('recent submenu missing');
		const labels = recent.children.map((c) => (c.type === 'item' ? c.label : '?'));
		expect(labels).toEqual(['a.md', 'b.md', 'c.md']);
	});

	it('Recent submenu falls back to full path when no slash present', () => {
		preferences.patch({ recentFiles: ['standalone.md'] });
		const items = buildContextMenuItems({ tr });
		const recent = items.find((i) => i.type === 'submenu' && i.label === 'recent');
		if (recent?.type !== 'submenu') throw new Error('recent submenu missing');
		const first = recent.children[0];
		expect(first.type).toBe('item');
		if (first.type !== 'item') return;
		expect(first.label).toBe('standalone.md');
	});

	it('every clickable item exposes a function onClick (no broken refs)', () => {
		preferences.patch({ recentFiles: ['/a.md'] });
		const items = buildContextMenuItems({ tr, tabId: 'tab-1' });
		for (const item of items) {
			if (item.type === 'item' && !item.disabled) {
				expect(typeof item.onClick).toBe('function');
			}
		}
	});
});
