import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

const { editor } = await import('$lib/stores/editor');
const { preferences } = await import('$lib/stores/preferences');
const { countVisualLines, countSourceLines } = await import('$lib/services/stats');
const { toasts, showToast, dismissToast } = await import('$lib/stores/toast');
vi.stubGlobal('crypto', { randomUUID: () => 'uuid-' + Math.random().toString(36).slice(2) });

// ─── TABS ───────────────────────────────────────────────

describe('Tab management — complete', () => {
  beforeEach(() => {
    // Clean slate
    for (const t of get(editor.tabs)) editor.closeTab(t.id);
  });

  it('Ctrl+N: new tab is empty, not duplicated', () => {
    const id1 = editor.addTab('/a.md', 'a.md', '# Content A');
    const id2 = editor.addTab(); // Ctrl+N equivalent
    const tabs = get(editor.tabs);
    expect(tabs.find(t => t.id === id2)!.content).toBe('\n');
    expect(tabs.find(t => t.id === id2)!.content).not.toBe('# Content A');
  });

  it('Ctrl+W: close active tab switches to adjacent', () => {
    const id1 = editor.addTab(null, 'a.md', 'a');
    const id2 = editor.addTab(null, 'b.md', 'b');
    const id3 = editor.addTab(null, 'c.md', 'c');
    editor.closeTab(id2);
    // Should switch to id1 or id3
    const active = get(editor.activeTabId);
    expect([id1, id3]).toContain(active);
  });

  it('close last tab sets activeTabId to null', () => {
    const id = editor.addTab();
    editor.closeTab(id);
    expect(get(editor.activeTabId)).toBeNull();
  });

  it('middle-click close: same as close tab', () => {
    const id = editor.addTab(null, 'mid.md', 'x');
    editor.closeTab(id); // same underlying operation
    expect(get(editor.tabs).find(t => t.id === id)).toBeUndefined();
  });

  it('tab unsaved indicator: isModified tracks changes', () => {
    const id = editor.addTab(null, 'mod.md', 'original');
    expect(get(editor.tabs).find(t => t.id === id)!.isModified).toBe(false);
    editor.updateContent(id, 'modified');
    expect(get(editor.tabs).find(t => t.id === id)!.isModified).toBe(true);
    editor.markSaved(id, 'modified');
    expect(get(editor.tabs).find(t => t.id === id)!.isModified).toBe(false);
  });

  it('open file: tab has correct path, name, content', () => {
    const id = editor.addTab('/home/user/doc.md', 'doc.md', '# My Doc\n\nContent');
    const tab = get(editor.tabs).find(t => t.id === id)!;
    expect(tab.path).toBe('/home/user/doc.md');
    expect(tab.name).toBe('doc.md');
    expect(tab.content).toBe('# My Doc\n\nContent');
  });

  it('50 tabs can coexist without issue', () => {
    for (let i = 0; i < 50; i++) {
      editor.addTab(null, `file${i}.md`, `content ${i}`);
    }
    expect(get(editor.tabs).length).toBe(50);
  });
});

// ─── PREFERENCES ────────────────────────────────────────

describe('Preferences — all settings', () => {
  it('theme defaults and patch', () => {
    expect(get(preferences).theme).toBe('dark');
    preferences.patch({ theme: 'one-dark' });
    expect(get(preferences).theme).toBe('one-dark');
    preferences.patch({ theme: 'dark' }); // reset
  });

  it('all 6 themes accepted', () => {
    const themes = ['light', 'dark', 'one-dark', 'graphite', 'material-dark', 'ulysses'];
    for (const theme of themes) {
      preferences.patch({ theme });
      expect(get(preferences).theme).toBe(theme);
    }
    preferences.patch({ theme: 'dark' });
  });

  it('font settings', () => {
    preferences.patch({ fontSize: 20, lineHeight: 1.8, fontFamily: 'serif' });
    const p = get(preferences);
    expect(p.fontSize).toBe(20);
    expect(p.lineHeight).toBe(1.8);
    expect(p.fontFamily).toBe('serif');
  });

  it('code font settings', () => {
    preferences.patch({ codeFontFamily: 'Fira Code', codeFontSize: 16 });
    const p = get(preferences);
    expect(p.codeFontFamily).toBe('Fira Code');
    expect(p.codeFontSize).toBe(16);
  });

  it('auto-save settings', () => {
    preferences.patch({ autoSave: true, autoSaveDelay: 10000 });
    const p = get(preferences);
    expect(p.autoSave).toBe(true);
    expect(p.autoSaveDelay).toBe(10000);
    preferences.patch({ autoSave: false });
  });

  it('view modes toggle independently', () => {
    preferences.patch({ sourceCodeMode: false, focusMode: true, typewriterMode: false, splitView: false });
    const p = get(preferences);
    expect(p.sourceCodeMode).toBe(false);
    expect(p.focusMode).toBe(true);
    expect(p.typewriterMode).toBe(false);
    preferences.patch({ focusMode: false });
  });

  it('interface toggles', () => {
    preferences.patch({ showTabBar: false, showStatusBar: false, sidebarVisible: true });
    const p = get(preferences);
    expect(p.showTabBar).toBe(false);
    expect(p.showStatusBar).toBe(false);
    expect(p.sidebarVisible).toBe(true);
    preferences.patch({ showTabBar: true, showStatusBar: true, sidebarVisible: false });
  });

  it('editor behavior settings', () => {
    preferences.patch({
      wordWrap: false, spellcheck: false, tabSize: 2,
      endOfLine: 'lf', textDirection: 'rtl',
      editorLineNumbers: true, codeBlockLineNumbers: false,
    });
    const p = get(preferences);
    expect(p.wordWrap).toBe(false);
    expect(p.spellcheck).toBe(false);
    expect(p.tabSize).toBe(2);
    expect(p.endOfLine).toBe('lf');
    expect(p.textDirection).toBe('rtl');
    expect(p.editorLineNumbers).toBe(true);
    expect(p.codeBlockLineNumbers).toBe(false);
  });

  it('auto-pair settings', () => {
    preferences.patch({ autoPairBracket: false, autoPairMarkdownSyntax: false, autoPairQuote: false });
    const p = get(preferences);
    expect(p.autoPairBracket).toBe(false);
    expect(p.autoPairMarkdownSyntax).toBe(false);
    expect(p.autoPairQuote).toBe(false);
  });

  it('markdown settings', () => {
    preferences.patch({
      bulletListMarker: '*', orderListDelimiter: ')',
      preferHeadingStyle: 'setext', frontmatterType: '+++',
      superSubScript: true, footnote: true,
      isHtmlEnabled: false, isGitlabCompatibilityEnabled: true,
    });
    const p = get(preferences);
    expect(p.bulletListMarker).toBe('*');
    expect(p.orderListDelimiter).toBe(')');
    expect(p.preferHeadingStyle).toBe('setext');
    expect(p.superSubScript).toBe(true);
    expect(p.footnote).toBe(true);
    expect(p.isHtmlEnabled).toBe(false);
  });

  it('diagram theme settings', () => {
    preferences.patch({ sequenceTheme: 'simple', mermaidTheme: 'dark', vegaTheme: 'fivethirtyeight' });
    const p = get(preferences);
    expect(p.sequenceTheme).toBe('simple');
    expect(p.mermaidTheme).toBe('dark');
    expect(p.vegaTheme).toBe('fivethirtyeight');
  });

  it('general settings', () => {
    preferences.patch({ startUpAction: 'lastState', fileSortBy: 'title', hideScrollbar: true, wordWrapInToc: true });
    const p = get(preferences);
    expect(p.startUpAction).toBe('lastState');
    expect(p.fileSortBy).toBe('title');
    expect(p.hideScrollbar).toBe(true);
    expect(p.wordWrapInToc).toBe(true);
  });

  it('zoom range', () => {
    preferences.patch({ zoom: 0.5 });
    expect(get(preferences).zoom).toBe(0.5);
    preferences.patch({ zoom: 2.0 });
    expect(get(preferences).zoom).toBe(2.0);
    preferences.patch({ zoom: 1.0 });
  });

  it('8 languages accepted', () => {
    const langs = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];
    for (const lang of langs) {
      preferences.patch({ language: lang });
      expect(get(preferences).language).toBe(lang);
    }
  });
});

// ─── TOC ────────────────────────────────────────────────
// TOC extraction is now a pure function in src/lib/services/toc.ts with
// dedicated unit tests at tests/services/toc.test.ts (22 cases including
// frontmatter and fenced code blocks). The editor store no longer holds
// a `toc` derived value — TocPane.svelte computes locally from activeTab.

// ─── STATS ──────────────────────────────────────────────

describe('Stats — line counting', () => {
  it('visual: paragraph separator lines not counted', () => {
    expect(countVisualLines('# Title\n\nPara 1\n\nPara 2\n\nPara 3')).toBe(4);
  });

  it('visual: list items counted individually', () => {
    expect(countVisualLines('- A\n- B\n- C')).toBe(3);
  });

  it('visual: code block lines counted', () => {
    expect(countVisualLines('```js\nconst a = 1;\nconst b = 2;\n```')).toBe(4);
  });

  it('visual: empty string = 0', () => {
    expect(countVisualLines('')).toBe(0);
  });

  it('visual: single line', () => {
    expect(countVisualLines('Hello')).toBe(1);
  });

  it('visual: trailing newlines ignored', () => {
    expect(countVisualLines('Line 1\n\n\n\n')).toBe(1);
  });

  it('source: counts every newline', () => {
    expect(countSourceLines('a\nb\nc')).toBe(3);
  });

  it('source: trailing newline adds a line', () => {
    expect(countSourceLines('a\nb\n')).toBe(3);
  });

  it('source: empty = 0', () => {
    expect(countSourceLines('')).toBe(0);
  });
});

// ─── i18n ───────────────────────────────────────────────

describe('i18n — all languages complete', () => {
  // Keys where the English translation differs from the key name
  const coreKeys = [
    'files', 'toc', 'settings', 'new_file', 'open_file',
    'unsaved_close', 'unsaved_quit', 'unsaved_title', 'save_btn', 'discard_btn', 'cancel_btn',
    'error_open_file', 'error_save_file',
    'auto_save', 'font_size', 'line_height', 'word_wrap',
    'read_only', 'source_code_mode', 'focus_mode', 'typewriter_mode', 'split_view',
  ];

  it('French has all core keys', async () => {
    const { t, setLanguage } = await import('$lib/i18n/index');
    setLanguage('fr');
    let tr: (k: string) => string = k => k;
    const unsub = t.subscribe((fn: any) => { tr = fn; });
    for (const key of coreKeys) {
      expect(tr(key), `FR missing: ${key}`).not.toBe(key);
    }
    unsub();
  });

  it('English has all core keys', async () => {
    const { t, setLanguage } = await import('$lib/i18n/index');
    setLanguage('en');
    let tr: (k: string) => string = k => k;
    const unsub = t.subscribe((fn: any) => { tr = fn; });
    for (const key of coreKeys) {
      expect(tr(key), `EN missing: ${key}`).not.toBe(key);
    }
    unsub();
  });

  it('all 8 languages have dialog keys', async () => {
    const { t, setLanguage } = await import('$lib/i18n/index');
    const langs = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];
    const dialogKeys = ['unsaved_title', 'save_btn', 'discard_btn', 'cancel_btn', 'error_open_file', 'error_save_file'];

    for (const lang of langs) {
      setLanguage(lang);
      let tr: (k: string) => string = k => k;
      const unsub = t.subscribe((fn: any) => { tr = fn; });
      for (const key of dialogKeys) {
        expect(tr(key), `${lang} missing: ${key}`).not.toBe(key);
      }
      unsub();
    }
  });
});

// ─── TOAST ──────────────────────────────────────────────

describe('Toast notifications', () => {
  beforeEach(() => { toasts.set([]); });

  it('show error toast', () => {
    showToast('Error!', 'error');
    expect(get(toasts).length).toBe(1);
    expect(get(toasts)[0].kind).toBe('error');
  });

  it('show warning toast', () => {
    showToast('Warn', 'warning');
    expect(get(toasts)[0].kind).toBe('warning');
  });

  it('show info toast', () => {
    showToast('Info', 'info');
    expect(get(toasts)[0].kind).toBe('info');
  });

  it('show success toast', () => {
    showToast('OK', 'success');
    expect(get(toasts)[0].kind).toBe('success');
  });

  it('dismiss removes correct toast', () => {
    const id1 = showToast('A', 'error', 0);
    const id2 = showToast('B', 'info', 0);
    dismissToast(id1);
    const items = get(toasts);
    expect(items.length).toBe(1);
    expect(items[0].text).toBe('B');
  });

  it('multiple toasts stack', () => {
    for (let i = 0; i < 5; i++) showToast(`Toast ${i}`, 'info', 0);
    expect(get(toasts).length).toBe(5);
  });
});

// ─── MUYA DIST API ──────────────────────────────────────

describe('Muya dist API — method verification', () => {
  it('has all required public methods', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dist = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/muya/dist/index.min.js'),
      'utf-8',
    );

    // Core editing
    expect(dist).toContain('getMarkdown()');
    expect(dist).toContain('setMarkdown(');

    // History
    expect(dist).toContain('undo()');
    expect(dist).toContain('redo()');
    expect(dist).toContain('clearHistory()');
    expect(dist).toContain('getHistory()');
    expect(dist).toContain('setHistory(');

    // Selection
    expect(dist).toContain('selectAll()');
    expect(dist).toContain('getCursor()');

    // Focus
    expect(dist).toContain('focus()');

    // Modes
    expect(dist).toContain('setFocusMode(');

    // Word count
    expect(dist).toContain('getWordCount(');

    // TOC
    expect(dist).toContain('getTOC()');

    // Events
    expect(dist).toContain('dispatchChange()');
    expect(dist).toContain('dispatchSelectionChange()');
  });
});
