import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface Preferences {
  theme: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  autoSave: boolean;
  autoSaveDelay: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
  spellcheck: boolean;
  language: string;
  sidebarVisible: boolean;
  recentFiles: string[];
  // View modes (readOnly is per-tab, on the Tab type, not here)
  sourceCodeMode: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  typewriterSounds: boolean;
  showTabBar: boolean;
  showStatusBar: boolean;
  splitView: boolean;
  // Editor settings
  codeFontFamily: string;
  codeFontSize: number;
  codeBlockLineNumbers: boolean;
  editorLineNumbers: boolean;
  tabSize: number;
  endOfLine: string;
  textDirection: string;
  editorLineWidth: string;
  trimUnnecessaryCodeBlockEmptyLines: boolean;
  trimTrailingNewline: number;
  hideQuickInsertHint: boolean;
  hideLinkPopup: boolean;
  autoCheck: boolean;
  autoPairBracket: boolean;
  autoPairMarkdownSyntax: boolean;
  autoPairQuote: boolean;
  // Markdown settings
  preferLooseListItem: boolean;
  bulletListMarker: string;
  orderListDelimiter: string;
  preferHeadingStyle: string;
  listIndentation: number | string;
  frontmatterType: string;
  superSubScript: boolean;
  footnote: boolean;
  isHtmlEnabled: boolean;
  isGitlabCompatibilityEnabled: boolean;
  sequenceTheme: string;
  mermaidTheme: string;
  vegaTheme: string;
  // General settings
  startUpAction: string;
  zoom: number;
  hideScrollbar: boolean;
  fileSortBy: string;
  wordWrapInToc: boolean;
}

const defaults: Preferences = {
  theme: 'dark',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 16,
  lineHeight: 1.6,
  autoSave: false,
  autoSaveDelay: 5000,
  wordWrap: true,
  showLineNumbers: false,
  spellcheck: true,
  language: 'en',
  sidebarVisible: false,
  recentFiles: [],
  sourceCodeMode: false,
  focusMode: false,
  typewriterMode: false,
  typewriterSounds: false,
  showTabBar: true,
  showStatusBar: true,
  splitView: false,
  // Editor settings
  codeFontFamily: 'DejaVu Sans Mono',
  codeFontSize: 14,
  codeBlockLineNumbers: true,
  editorLineNumbers: false,
  tabSize: 4,
  endOfLine: 'default',
  textDirection: 'ltr',
  editorLineWidth: '',
  trimUnnecessaryCodeBlockEmptyLines: true,
  trimTrailingNewline: 2,
  hideQuickInsertHint: false,
  hideLinkPopup: false,
  autoCheck: false,
  autoPairBracket: true,
  autoPairMarkdownSyntax: true,
  autoPairQuote: true,
  // Markdown settings
  preferLooseListItem: true,
  bulletListMarker: '-',
  orderListDelimiter: '.',
  preferHeadingStyle: 'atx',
  listIndentation: 1,
  frontmatterType: '-',
  superSubScript: false,
  footnote: false,
  isHtmlEnabled: true,
  isGitlabCompatibilityEnabled: false,
  sequenceTheme: 'hand',
  mermaidTheme: 'default',
  vegaTheme: 'latimes',
  // General settings
  startUpAction: 'blank',
  zoom: 1.0,
  hideScrollbar: false,
  fileSortBy: 'modified',
  wordWrapInToc: false,
};

function createPreferencesStore() {
  const { subscribe, set, update } = writable<Preferences>(defaults);

  async function load() {
    try {
      const prefs = await invoke<Preferences>('load_preferences');
      set(prefs);
    } catch {
      set(defaults);
    }
  }

  async function save(prefs: Preferences) {
    set(prefs);
    await invoke('save_preferences', { prefs });
  }

  async function patch(partial: Partial<Preferences>) {
    update((current) => {
      const updated = { ...current, ...partial };
      invoke('save_preferences', { prefs: updated }).catch((e) => console.warn('[Preferences] save failed:', e));
      return updated;
    });
  }

  return { subscribe, load, save, patch };
}

export const preferences = createPreferencesStore();
