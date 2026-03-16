import { get } from 'svelte/store';
import { muyaInstance } from '$lib/stores/editor';
import type { Preferences } from '$lib/stores/preferences';
import type { MuyaInstance } from '$lib/types/muya-instance';
import { dlog } from '$lib/services/debug';

type ChangeCallback = (changes: any) => void;
type SelectionCallback = () => void;

/**
 * Singleton service encapsulating ALL Muya editor interactions.
 * No other module should access the Muya instance directly.
 */
class MuyaService {
  private muya: MuyaInstance | null = null;
  private container: HTMLElement | null = null;
  private changeCallbacks: ChangeCallback[] = [];
  private selectionCallbacks: SelectionCallback[] = [];

  /**
   * Initialize Muya on a given DOM element with initial options.
   * Returns the Muya instance (for legacy compatibility) or null on failure.
   */
  /** Initializes the Muya WYSIWYG editor in the given container element. */
  init(element: HTMLElement, prefs: Preferences): MuyaInstance | null {
    const Muya = (window as any).Muya;
    if (!Muya) {
      console.error('[MiraMD] window.Muya is undefined');
      return null;
    }
    const MuyaClass = Muya.default || Muya;

    const editor: MuyaInstance = new MuyaClass(element, {
      markdown: '',
      fontSize: prefs.fontSize || 16,
      lineHeight: prefs.lineHeight || 1.6,
      focusMode: prefs.focusMode || false,
      autoPairBracket: prefs.autoPairBracket ?? true,
      autoPairMarkdownSyntax: prefs.autoPairMarkdownSyntax ?? true,
      autoPairQuote: prefs.autoPairQuote ?? true,
      bulletListMarker: prefs.bulletListMarker || '-',
      orderListDelimiter: prefs.orderListDelimiter || '.',
      tabSize: prefs.tabSize || 4,
      codeBlockLineNumbers: prefs.codeBlockLineNumbers ?? true,
      listIndentation: prefs.listIndentation ?? 1,
      frontmatterType: prefs.frontmatterType || '-',
      sequenceTheme: prefs.sequenceTheme || 'hand',
      mermaidTheme: prefs.mermaidTheme || 'default',
      vegaTheme: prefs.vegaTheme || 'latimes',
      hideQuickInsertHint: prefs.hideQuickInsertHint ?? false,
      hideLinkPopup: prefs.hideLinkPopup ?? false,
      autoCheck: prefs.autoCheck ?? false,
      spellcheckEnabled: prefs.spellcheck ?? false,
      superSubScript: prefs.superSubScript ?? false,
      footnote: prefs.footnote ?? false,
      isGitlabCompatibilityEnabled: prefs.isGitlabCompatibilityEnabled ?? false,
      disableHtml: !(prefs.isHtmlEnabled ?? true),
      trimUnnecessaryCodeBlockEmptyLines: prefs.trimUnnecessaryCodeBlockEmptyLines ?? true,
      trimTrailingNewline: prefs.trimTrailingNewline ?? 2,
      textDirection: prefs.textDirection || 'ltr',
      codeFontFamily: prefs.codeFontFamily || 'DejaVu Sans Mono',
      codeFontSize: prefs.codeFontSize || 14,
      endOfLine: prefs.endOfLine || 'default',
      editorLineWidth: prefs.editorLineWidth || '',
      preferLooseListItem: prefs.preferLooseListItem ?? true,
      preferHeadingStyle: prefs.preferHeadingStyle || 'atx',
    });

    this.muya = editor;
    this.container = element;
    muyaInstance.set(editor);

    // Wire up internal event forwarding
    editor.on('change', (changes: any) => {
      for (const cb of this.changeCallbacks) cb(changes);
    });
    editor.on('selectionChange', () => {
      for (const cb of this.selectionCallbacks) cb();
    });

    return editor;
  }

  /** Tears down the Muya instance and clears all event callbacks. */
  destroy(): void {
    try { this.muya?.destroy(); } catch (e) { dlog('muya', 'destroy:', e); }
    this.muya = null;
    this.container = null;
    this.changeCallbacks = [];
    this.selectionCallbacks = [];
    muyaInstance.set(null);
  }

  /** Returns the current markdown content from the editor. */
  getMarkdown(): string {
    if (!this.muya) return '';
    try { return this.muya.getMarkdown(); } catch (e) { dlog('muya', 'getMarkdown:', e); return ''; }
  }

  /** Replaces the editor content with the given markdown string. */
  setMarkdown(md: string): void {
    if (!this.muya) return;
    try { this.muya.setMarkdown(md); } catch (e) { dlog('muya', 'setMarkdown:', e); }
  }

  undo(): void {
    if (!this.muya) {
      dlog('ctrlz', 'muyaService.undo() — this.muya is null, no-op');
      return;
    }
    try {
      const before = this.getMarkdown();
      this.muya.undo();
      const after = this.getMarkdown();
      dlog('ctrlz', 'muya.undo() OK — markdown changed?', before !== after, 'before len:', before.length, 'after len:', after.length);
    } catch (e) {
      dlog('ctrlz', 'muya.undo() THREW:', e);
      dlog('muya', 'undo:', e);
    }
  }

  redo(): void {
    if (!this.muya) {
      dlog('ctrlz', 'muyaService.redo() — this.muya is null, no-op');
      return;
    }
    try {
      const before = this.getMarkdown();
      this.muya.redo();
      const after = this.getMarkdown();
      dlog('ctrlz', 'muya.redo() OK — markdown changed?', before !== after, 'before len:', before.length, 'after len:', after.length);
    } catch (e) {
      dlog('ctrlz', 'muya.redo() THREW:', e);
      dlog('muya', 'redo:', e);
    }
  }

  clearHistory(): void {
    if (!this.muya) return;
    try { this.muya.clearHistory(); } catch (e) { dlog('muya', 'clearHistory:', e); }
  }

  getHistory(): unknown {
    if (!this.muya) return null;
    try { return this.muya.getHistory(); } catch (e) { dlog('muya', 'getHistory:', e); return null; }
  }

  setHistory(history: unknown): void {
    if (!this.muya || !history) return;
    try { this.muya.setHistory(history); } catch (e) { dlog('muya', 'setHistory:', e); }
  }

  getCursor(): unknown {
    if (!this.muya) return null;
    try { return this.muya.getCursor(); } catch (e) { dlog('muya', 'getCursor:', e); return null; }
  }

  selectAll(): void {
    if (!this.muya) return;
    try { this.muya.selectAll(); } catch (e) { dlog('muya', 'selectAll:', e); }
  }

  focus(): void {
    if (!this.muya) return;
    try { this.muya.focus(); } catch (e) { dlog('muya', 'focus:', e); }
  }

  setFocusMode(enabled: boolean): void {
    if (!this.muya) return;
    try { this.muya.setFocusMode(enabled); } catch (e) { dlog('muya', 'setFocusMode:', e); }
  }

  setFont(opts: { fontSize: number; lineHeight: number }): void {
    if (!this.muya) return;
    try { this.muya.setFont(opts); } catch (e) { dlog('muya', 'setFont:', e); }
  }

  setOptions(opts: Record<string, unknown>, silent?: boolean): void {
    if (!this.muya) return;
    try { this.muya.setOptions(opts, silent); } catch (e) { dlog('muya', 'setOptions:', e); }
  }

  /** Promote heading level on the current block: plain→h6→h5→…→h1 (stops at h1). */
  shiftHeadingUp(): void {
    if (!this.muya) return;
    try { (this.muya as unknown as { updateParagraph: (t: string) => void }).updateParagraph('upgrade heading'); }
    catch (e) { dlog('muya', 'shiftHeadingUp:', e); }
  }

  /** Demote heading level: h1→h2→…→h6→plain (stops at plain). */
  shiftHeadingDown(): void {
    if (!this.muya) return;
    try { (this.muya as unknown as { updateParagraph: (t: string) => void }).updateParagraph('degrade heading'); }
    catch (e) { dlog('muya', 'shiftHeadingDown:', e); }
  }

  /** Reset any heading on the current block back to a plain paragraph. */
  resetToParagraph(): void {
    if (!this.muya) return;
    try { (this.muya as unknown as { updateParagraph: (t: string) => void }).updateParagraph('paragraph'); }
    catch (e) { dlog('muya', 'resetToParagraph:', e); }
  }

  /** Apply all preference changes to the running Muya instance */
  applyPreferences(p: Preferences): void {
    if (!this.muya) return;
    try {
      this.muya.setFont({ fontSize: p.fontSize || 16, lineHeight: p.lineHeight || 1.6 });
      this.muya.setFocusMode(p.focusMode || false);
      this.muya.setOptions({
        tabSize: p.tabSize,
        bulletListMarker: p.bulletListMarker,
        orderListDelimiter: p.orderListDelimiter,
        listIndentation: p.listIndentation,
        frontmatterType: p.frontmatterType,
        sequenceTheme: p.sequenceTheme,
        mermaidTheme: p.mermaidTheme,
        vegaTheme: p.vegaTheme,
        superSubScript: p.superSubScript,
        footnote: p.footnote,
        isGitlabCompatibilityEnabled: p.isGitlabCompatibilityEnabled,
        disableHtml: !p.isHtmlEnabled,
        codeBlockLineNumbers: p.codeBlockLineNumbers,
        trimUnnecessaryCodeBlockEmptyLines: p.trimUnnecessaryCodeBlockEmptyLines,
        hideQuickInsertHint: p.hideQuickInsertHint,
        hideLinkPopup: p.hideLinkPopup,
        autoCheck: p.autoCheck,
        autoPairBracket: p.autoPairBracket,
        autoPairMarkdownSyntax: p.autoPairMarkdownSyntax,
        autoPairQuote: p.autoPairQuote,
        textDirection: p.textDirection,
        codeFontFamily: p.codeFontFamily,
        codeFontSize: p.codeFontSize,
        trimTrailingNewline: p.trimTrailingNewline,
        endOfLine: p.endOfLine,
        editorLineWidth: p.editorLineWidth,
        preferLooseListItem: p.preferLooseListItem,
        preferHeadingStyle: p.preferHeadingStyle,
        spellcheckEnabled: p.spellcheck,
      }, true);
    } catch (e) { dlog('muya', 'applyPreferences:', e); }
  }

  /** Registers a callback for content changes; returns an unsubscribe function. */
  onChange(callback: ChangeCallback): () => void {
    this.changeCallbacks.push(callback);
    return () => {
      this.changeCallbacks = this.changeCallbacks.filter((cb) => cb !== callback);
    };
  }

  /** Registers a callback for cursor/selection changes; returns an unsubscribe function. */
  onSelectionChange(callback: SelectionCallback): () => void {
    this.selectionCallbacks.push(callback);
    return () => {
      this.selectionCallbacks = this.selectionCallbacks.filter((cb) => cb !== callback);
    };
  }

  /** Returns true if the Muya editor has been initialized and is available. */
  isReady(): boolean {
    return this.muya !== null;
  }

  /** Direct Muya access for editorModes (blur) and MuyaPane (tab switching). */
  getInstance(): MuyaInstance | null {
    return this.muya;
  }
}

export const muyaService = new MuyaService();
