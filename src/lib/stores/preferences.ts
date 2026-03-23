import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { showToast } from '$lib/stores/toast';
import { t, type TranslationKey } from '$lib/i18n/index';

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
  typewriterSoundsVolume: number;
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
  typewriterSoundsVolume: 1.0,
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

interface LoadResult {
  prefs: Preferences;
  warnings: string[];
}

interface SaveResult {
  warnings: string[];
}

const WARNING_KIND: Record<string, 'warning' | 'error' | 'info'> = {
  prefs_tmp_fallback: 'warning',
  prefs_backup_failed: 'warning',
};

function reportWarnings(warnings: string[]) {
  if (!warnings || warnings.length === 0) return;
  const tr = get(t);
  for (const code of warnings) {
    const key = `warning_${code}` as TranslationKey;
    showToast(tr(key), WARNING_KIND[code] ?? 'warning');
  }
}

function reportSaveError(e: unknown) {
  console.error('[Preferences] save failed:', e);
  showToast(get(t)('error_prefs_save'), 'error');
}

function createPreferencesStore() {
  const { subscribe, set, update } = writable<Preferences>(defaults);

  async function load() {
    try {
      const result = await invoke<LoadResult>('load_preferences');
      set(result.prefs);
      reportWarnings(result.warnings);
    } catch {
      set(defaults);
    }
  }

  async function save(prefs: Preferences) {
    set(prefs);
    try {
      const result = await invoke<SaveResult>('save_preferences', { prefs });
      reportWarnings(result.warnings);
    } catch (e) {
      reportSaveError(e);
      throw e;
    }
  }

  function patch(partial: Partial<Preferences>) {
    update((current) => {
      const updated = { ...current, ...partial };
      invoke<SaveResult>('save_preferences', { prefs: updated })
        .then((r) => reportWarnings(r.warnings))
        .catch(reportSaveError);
      return updated;
    });
  }

  return { subscribe, load, save, patch };
}

export const preferences = createPreferencesStore();
