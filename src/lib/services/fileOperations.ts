import type { TranslationKey } from '$lib/i18n/index';
import { invokeWithTimeout } from '$lib/services/ipc';
import { muyaService } from '$lib/services/muya';
import { pushRecentFile } from '$lib/services/recentFiles';
import { editor } from '$lib/stores/editor';
import { preferences } from '$lib/stores/preferences';
import { showToast } from '$lib/stores/toast';
import type { Tab } from '$lib/types/editor';
import { message, open, save } from '@tauri-apps/plugin-dialog';
import { get } from 'svelte/store';

/** Extensions traitées en plain text (= force source mode à l'ouverture).
 *  Le rendu WYSIWYG Markdown sur un .txt n'a aucun sens — ça transforme les
 *  retours à la ligne en paragraphes, applique du formatage Markdown sur du
 *  texte qui n'en est pas, et fait perdre la mise en forme exacte. */
const PLAIN_TEXT_EXTENSIONS = ['txt'] as const;

function isPlainTextPath(path: string | null | undefined): boolean {
	if (!path) return false;
	const ext = path.split('.').pop()?.toLowerCase();
	return PLAIN_TEXT_EXTENSIONS.includes(ext as (typeof PLAIN_TEXT_EXTENSIONS)[number]);
}

/** Force le mode source si le fichier ouvert est plain text. À appeler après
 *  chaque `editor.addTab(path, …)` pour un fichier disque. No-op si déjà actif
 *  ou si le path est null (nouveau tab vide). */
function forceSourceModeIfPlainText(path: string | null | undefined): void {
	if (!isPlainTextPath(path)) return;
	if (get(preferences).sourceCodeMode) return;
	preferences.patch({ sourceCodeMode: true });
}

function getCurrentTabId(): string | null {
	return get(editor.activeTabId);
}

function getCurrentTab(): Tab | null {
	return get(editor.activeTab);
}

/** Opens a native file picker for markdown files and adds each selected file as a tab. */
export async function openFileDialog(tr: (k: TranslationKey) => string) {
	const selected = await open({
		multiple: true,
		filters: [{ name: 'Markdown / Text', extensions: ['md', 'markdown', 'mmd', 'mdx', 'mkd', 'txt'] }],
	});

	if (selected) {
		const paths = Array.isArray(selected) ? selected : [selected];
		for (const filePath of paths) {
			// Dédup : si déjà ouvert, juste switch dessus (pas de re-read disque).
			const existing = get(editor.tabs).find((t) => t.path === filePath);
			if (existing) {
				editor.activeTabId.set(existing.id);
				forceSourceModeIfPlainText(filePath);
				continue;
			}
			try {
				const file = await invokeWithTimeout<{ path: string; name: string; content: string; size: number }>(
					'read_file',
					{ path: filePath },
				);
				editor.addTab(file.path, file.name, file.content);
				pushRecentFile(file.path);
				forceSourceModeIfPlainText(file.path);
			} catch (err) {
				console.error('Failed to open file:', err);
				showToast(tr('error_open_file'), 'error');
			}
		}
	}
}

/** Saves the active tab's content to disk, prompting for a path if the file is new.
 * Returns `true` on success, `false` on user-visible failure (or cancelled dialog). */
export async function saveCurrentFile(tr: (k: TranslationKey) => string): Promise<boolean> {
	const tab = getCurrentTab();
	if (!tab) return false;

	const content = muyaService.isReady() ? muyaService.getMarkdown() : tab.content;

	if (tab.path) {
		try {
			await invokeWithTimeout('write_file', { path: tab.path, content });
			editor.markSaved(tab.id, content);
			return true;
		} catch (err) {
			console.error('Failed to save:', err);
			showToast(tr('error_save_file'), 'error');
			return false;
		}
	}
	const path = await save({
		filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
		defaultPath: tab.name,
	});
	if (!path) return false;
	try {
		await invokeWithTimeout('write_file', { path, content });
		editor.markSaved(tab.id, content);
		editor.tabs.update((t) =>
			t.map((tt) => (tt.id === tab.id ? { ...tt, path, name: path.split('/').pop() || tab.name } : tt)),
		);
		return true;
	} catch (err) {
		console.error('Failed to save:', err);
		showToast(tr('error_save_file'), 'error');
		return false;
	}
}

/** Closes a tab, showing a save/discard/cancel dialog if it has unsaved changes. */
export async function closeTabWithConfirm(id: string, tr: (k: TranslationKey) => string) {
	const tabs = get(editor.tabs);
	const tab = tabs.find((x) => x.id === id) ?? null;
	if (tab?.isModified) {
		const result = await message(`"${tab.name}" ${tr('unsaved_close')}`, {
			title: tr('unsaved_title'),
			kind: 'warning',
			buttons: { yes: tr('save_btn'), no: tr('discard_btn'), cancel: tr('cancel_btn') },
		});
		if (result === 'Cancel') return;
		if (result === 'Yes' && tab.path) {
			try {
				await invokeWithTimeout('write_file', { path: tab.path, content: tab.content });
				editor.markSaved(id);
			} catch (err) {
				console.error('Save failed:', err);
				showToast(tr('error_save_file'), 'error');
				return;
			}
		}
	}
	editor.closeTab(id);
}

/** Force-opens the "Save As" dialog for the active tab, even if it already has a path.
 * On success, updates the tab's path/name to the new location so subsequent saves
 * go there. Returns `true` on success, `false` on cancel or failure. */
export async function saveCurrentFileAs(tr: (k: TranslationKey) => string): Promise<boolean> {
	const tab = getCurrentTab();
	if (!tab) return false;
	const content = muyaService.isReady() ? muyaService.getMarkdown() : tab.content;
	const path = await save({
		filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
		defaultPath: tab.path ?? tab.name,
	});
	if (!path) return false;
	try {
		await invokeWithTimeout('write_file', { path, content });
		editor.markSaved(tab.id, content);
		editor.tabs.update((tabs) =>
			tabs.map((tt) => (tt.id === tab.id ? { ...tt, path, name: path.split('/').pop() || tab.name } : tt)),
		);
		pushRecentFile(path);
		return true;
	} catch (err) {
		console.error('Failed to save as:', err);
		showToast(tr('error_save_file'), 'error');
		return false;
	}
}

/** Duplicates a tab as a new tab (same content, no path so first Ctrl+S opens
 * the save-as dialog). If `id` is omitted, duplicates the active tab. */
export function duplicateTab(id?: string): void {
	const tabs = get(editor.tabs);
	const tab = id ? tabs.find((t) => t.id === id) : getCurrentTab();
	if (!tab) return;
	editor.addTab(null, tab.name, tab.content);
}

const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mmd', 'mdx', 'mkd', 'txt'] as const;

const MARKDOWN_EXTENSION_RE = new RegExp(`\\.(${MARKDOWN_EXTENSIONS.join('|')})$`, 'i');

/** Returns true if the path ends with one of the recognized markdown extensions. */
export function isMarkdownPath(path: string): boolean {
	return MARKDOWN_EXTENSION_RE.test(path);
}

/**
 * Opens each markdown file from a list of paths (e.g., from a drag-and-drop
 * drop event). Non-markdown paths are silently skipped. Returns the count of
 * files actually opened.
 */
export async function openDroppedMarkdownFiles(paths: string[], tr: (k: TranslationKey) => string): Promise<number> {
	let opened = 0;
	for (const path of paths) {
		if (!isMarkdownPath(path)) continue;
		await openFileFromPath(path, tr);
		opened += 1;
	}
	return opened;
}

/** Opens a file from a known filesystem path and adds it as a tab.
 *  Si un tab avec ce path est déjà ouvert, on switch dessus au lieu de créer
 *  un doublon (clic répété sur un fichier déjà chargé dans la sidebar). */
export async function openFileFromPath(path: string, tr: (k: TranslationKey) => string) {
	const existing = get(editor.tabs).find((t) => t.path === path);
	if (existing) {
		editor.activeTabId.set(existing.id);
		// Re-force source mode quand le tab actif redevient un .txt — au cas où
		// l'utilisateur aurait toggled (sera bientôt verrouillé, mais ceinture+bretelles).
		forceSourceModeIfPlainText(path);
		return;
	}
	try {
		const file = await invokeWithTimeout<{ path: string; name: string; content: string; size: number }>('read_file', {
			path,
		});
		editor.addTab(file.path, file.name, file.content);
		pushRecentFile(file.path);
		forceSourceModeIfPlainText(file.path);
	} catch (err) {
		console.error('Failed to open file:', err);
		showToast(tr('error_open_file'), 'error');
	}
}

export { getCurrentTabId, getCurrentTab };
