import { invoke } from '@tauri-apps/api/core';
import { open, message, save } from '@tauri-apps/plugin-dialog';
import { get } from 'svelte/store';
import { editor } from '$lib/stores/editor';
import type { Tab } from '$lib/types/editor';
import { muyaService } from '$lib/services/muya';
import { showToast } from '$lib/stores/toast';
import type { TranslationKey } from '$lib/i18n/index';

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
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mmd', 'mdx', 'mkd'] }],
  });

  if (selected) {
    const paths = Array.isArray(selected) ? selected : [selected];
    for (const filePath of paths) {
      try {
        const file = await invoke<{ path: string; name: string; content: string; size: number }>(
          'read_file',
          { path: filePath }
        );
        editor.addTab(file.path, file.name, file.content);
      } catch (err) {
        console.error('Failed to open file:', err);
        showToast(tr('error_open_file'), 'error');
      }
    }
  }
}

/** Saves the active tab's content to disk, prompting for a path if the file is new. */
export async function saveCurrentFile(tr: (k: TranslationKey) => string) {
  const tab = getCurrentTab();
  if (!tab) return;

  const content = muyaService.isReady() ? muyaService.getMarkdown() : tab.content;

  if (tab.path) {
    try {
      await invoke('write_file', { path: tab.path, content });
      editor.markSaved(tab.id, content);
    } catch (err) {
      console.error('Failed to save:', err);
      showToast(tr('error_save_file'), 'error');
    }
  } else {
    const path = await save({
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      defaultPath: tab.name,
    });
    if (path) {
      try {
        await invoke('write_file', { path, content });
        editor.markSaved(tab.id, content);
        editor.tabs.update((t) =>
          t.map((tt) => tt.id === tab.id ? { ...tt, path, name: path.split('/').pop() || tab.name } : tt)
        );
      } catch (err) {
        console.error('Failed to save:', err);
        showToast(tr('error_save_file'), 'error');
      }
    }
  }
}

/** Closes a tab, showing a save/discard/cancel dialog if it has unsaved changes. */
export async function closeTabWithConfirm(id: string, tr: (k: TranslationKey) => string) {
  const tabs = get(editor.tabs);
  const tab = tabs.find((x) => x.id === id) ?? null;
  if (tab?.isModified) {
    const result = await message(
      `"${tab.name}" ${tr('unsaved_close')}`,
      {
        title: tr('unsaved_title'),
        kind: 'warning',
        buttons: { yes: tr('save_btn'), no: tr('discard_btn'), cancel: tr('cancel_btn') },
      }
    );
    if (result === 'Cancel') return;
    if (result === 'Yes' && tab.path) {
      try {
        await invoke('write_file', { path: tab.path, content: tab.content });
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

/** Opens a file from a known filesystem path and adds it as a tab. */
export async function openFileFromPath(path: string, tr: (k: TranslationKey) => string) {
  try {
    const file = await invoke<{ path: string; name: string; content: string; size: number }>(
      'read_file',
      { path }
    );
    editor.addTab(file.path, file.name, file.content);
  } catch (err) {
    console.error('Failed to open file:', err);
    showToast(tr('error_open_file'), 'error');
  }
}

export { getCurrentTabId, getCurrentTab };
