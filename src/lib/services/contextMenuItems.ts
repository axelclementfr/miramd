import type { ContextMenuItem } from '$lib/components/ContextMenu.svelte';
import type { TranslationKey } from '$lib/i18n/index';
import { editor } from '$lib/stores/editor';
import { preferences } from '$lib/stores/preferences';
import { uiActions } from '$lib/stores/uiActions';
import { get } from 'svelte/store';
import {
	closeTabWithConfirm,
	duplicateTab,
	openFileDialog,
	openFileFromPath,
	saveCurrentFile,
	saveCurrentFileAs,
} from './fileOperations';

const ICON_PLUS = 'M12 5v14M5 12h14';
const ICON_FILE = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6';
const ICON_FOLDER = 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z';
const ICON_CLOCK = 'M12 6v6l4 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z';
const ICON_SAVE = 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8';
const ICON_SAVE_AS = 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M16 8l2 2-7 7H9v-2z';
const ICON_DUPLICATE =
	'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1';
const ICON_X = 'M18 6 6 18 M6 6l12 12';

export interface BuildOptions {
	tr: (k: TranslationKey) => string;
	/** Si fourni, ajoute Dupliquer + Fermer onglet en bas du menu, ciblant ce tab.
	 *  Si non fourni, le menu est "général" (clic droit sur l'entête "Fichiers ouverts"). */
	tabId?: string;
}

export function buildContextMenuItems(opts: BuildOptions): ContextMenuItem[] {
	const { tr, tabId } = opts;
	const recentFiles = get(preferences).recentFiles ?? [];

	const recentChildren: ContextMenuItem[] =
		recentFiles.length === 0
			? [{ type: 'item', label: tr('no_recent_files'), onClick: () => {}, disabled: true }]
			: recentFiles.map<ContextMenuItem>((path) => ({
					type: 'item',
					label: pathToLabel(path),
					onClick: () => openFileFromPath(path, tr),
				}));

	const items: ContextMenuItem[] = [
		{ type: 'item', label: tr('new_tab'), iconPath: ICON_PLUS, onClick: () => editor.addTab() },
		{ type: 'separator' },
		{ type: 'item', label: tr('open_file'), iconPath: ICON_FILE, onClick: () => openFileDialog(tr) },
		{
			type: 'item',
			label: tr('open_folder'),
			iconPath: ICON_FOLDER,
			onClick: async () => {
				const fn = get(uiActions).openFolder;
				if (fn) await fn();
			},
		},
		{ type: 'submenu', label: tr('recent'), iconPath: ICON_CLOCK, children: recentChildren },
		{ type: 'separator' },
		{ type: 'item', label: tr('save'), iconPath: ICON_SAVE, onClick: () => saveCurrentFile(tr) },
		{ type: 'item', label: tr('save_as'), iconPath: ICON_SAVE_AS, onClick: () => saveCurrentFileAs(tr) },
	];

	if (tabId !== undefined) {
		items.push(
			{ type: 'separator' },
			{ type: 'item', label: tr('duplicate'), iconPath: ICON_DUPLICATE, onClick: () => duplicateTab(tabId) },
			{ type: 'item', label: tr('close_tab'), iconPath: ICON_X, onClick: () => closeTabWithConfirm(tabId, tr) },
		);
	}

	return items;
}

function pathToLabel(path: string): string {
	return path.split('/').pop() || path;
}
