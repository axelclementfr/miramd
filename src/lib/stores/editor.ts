import { writable, derived, get } from 'svelte/store';
import type { Tab, DocumentStats, TocEntry } from '$lib/types/editor';

export type { Tab, DocumentStats, TocEntry };

/** Global reference to the Muya editor instance — managed by muyaService.init()/destroy() */
export const muyaInstance = writable<any>(null);

const HEADING_REGEX = /^(#{1,6})\s+(.+)/;

function extractHeadings(content: string): TocEntry[] {
  const headings: TocEntry[] = [];
  const lines = content.split('\n');
  let pos = 0;
  for (const line of lines) {
    const match = line.match(HEADING_REGEX);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/\s*#+\s*$/, '').trim(),
        pos,
      });
    }
    pos += line.length + 1;
  }
  return headings;
}

function createEditorStore() {
  const tabs = writable<Tab[]>([]);
  const activeTabId = writable<string | null>(null);
  const stats = writable<DocumentStats>({ words: 0, chars: 0, lines: 0, paragraphs: 0 });
  const toc = writable<TocEntry[]>([]);

  /** Debounce timer for TOC extraction during content edits */
  let tocDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const TOC_DEBOUNCE_MS = 300;

  function debouncedTocUpdate(content: string) {
    if (tocDebounceTimer !== null) clearTimeout(tocDebounceTimer);
    tocDebounceTimer = setTimeout(() => {
      toc.set(extractHeadings(content));
      tocDebounceTimer = null;
    }, TOC_DEBOUNCE_MS);
  }

  const activeTab = derived([tabs, activeTabId], ([$tabs, $activeTabId]) =>
    $tabs.find((t) => t.id === $activeTabId) ?? null
  );

  function generateId(): string {
    return crypto.randomUUID();
  }

  function addTab(path: string | null = null, name: string = 'Untitled.md', content: string = '') {
    const id = generateId();
    // Muya produces '\n' for empty documents, so set savedContent to match
    const saved = content || '\n';
    const tab: Tab = { id, path, name, content: saved, savedContent: saved, isModified: false };
    tabs.update((t) => [...t, tab]);
    activeTabId.set(id);
    // Update TOC when opening a file with content
    if (content) {
      toc.set(extractHeadings(content));
    }
    return id;
  }

  function closeTab(id: string) {
    tabs.update((t) => {
      const idx = t.findIndex((tab) => tab.id === id);
      const filtered = t.filter((tab) => tab.id !== id);
      if (filtered.length > 0) {
        activeTabId.update((current) => {
          if (current === id) {
            const newIdx = Math.min(idx, filtered.length - 1);
            return filtered[newIdx].id;
          }
          return current;
        });
      } else {
        activeTabId.set(null);
      }
      return filtered;
    });
  }

  function updateContent(id: string, content: string) {
    tabs.update((t) =>
      t.map((tab) =>
        tab.id === id ? { ...tab, content, isModified: content !== tab.savedContent } : tab
      )
    );
    // Debounce TOC extraction — runs 300ms after last keystroke
    debouncedTocUpdate(content);
  }

  function markSaved(id: string, content?: string) {
    tabs.update((t) =>
      t.map((tab) => {
        if (tab.id !== id) return tab;
        const saved = content !== undefined ? content : tab.content;
        return { ...tab, content: saved, savedContent: saved, isModified: false };
      })
    );
  }

  // Check if any tab has unsaved changes
  function hasUnsavedChanges(): boolean {
    return get(tabs).some((tab) => tab.isModified);
  }

  /** Sets a tab's read-only flag. Session-only state. */
  function setTabReadOnly(id: string, readOnly: boolean) {
    tabs.update((t) => t.map((tab) => (tab.id === id ? { ...tab, readOnly } : tab)));
  }

  /** Toggles the active tab's read-only flag. No-op if no active tab. */
  function toggleActiveTabReadOnly() {
    const id = get(activeTabId);
    if (!id) return;
    tabs.update((t) => t.map((tab) => (tab.id === id ? { ...tab, readOnly: !tab.readOnly } : tab)));
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    stats,
    toc,
    addTab,
    closeTab,
    updateContent,
    markSaved,
    hasUnsavedChanges,
    setTabReadOnly,
    toggleActiveTabReadOnly,
  };
}

export const editor = createEditorStore();
