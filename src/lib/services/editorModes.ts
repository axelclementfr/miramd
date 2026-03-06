import { writable, derived, get } from 'svelte/store';
import { preferences } from '$lib/stores/preferences';
import { editor as editorStore } from '$lib/stores/editor';
import { muyaService } from './muya';

export interface EditorState {
  readOnly: boolean;
  sourceCode: boolean;
  splitView: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
}

/**
 * Centralized editor mode state machine.
 * Derives state from preferences and provides toggles that correctly
 * handle mode interactions (e.g., source mode disables focus/typewriter).
 */
class EditorModes {
  /** Reactive state — readOnly is per-tab, other modes are global preferences. */
  readonly state = derived([preferences, editorStore.activeTab], ([p, tab]): EditorState => ({
    readOnly: !!tab?.readOnly,
    sourceCode: p.sourceCodeMode,
    splitView: p.splitView,
    focusMode: p.focusMode,
    typewriterMode: p.typewriterMode,
  }));

  /** Source content for the source-code textarea */
  readonly sourceContent = writable<string>('');

  private prevSourceCode = false;
  private readOnlyKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private readOnlyInputHandler: ((e: Event) => void) | null = null;

  /**
   * Initialize mode tracking. Call once from the editor container on mount.
   * Returns an unsubscribe function.
   */
  init(): () => void {
    const unsubs: (() => void)[] = [];

    // Sync source content when active tab changes (but NOT when in source mode — textarea is source of truth)
    unsubs.push(editorStore.activeTab.subscribe((tab) => {
      if (tab && !this.prevSourceCode) {
        this.sourceContent.set(tab.content);
      }
    }));

    // Handle source code mode transitions
    unsubs.push(preferences.subscribe((p) => {
      const wasSource = this.prevSourceCode;
      this.prevSourceCode = p.sourceCodeMode;

      if (p.sourceCodeMode && !wasSource && muyaService.isReady()) {
        // Entering source mode: grab content from Muya and normalize blank lines
        const md = muyaService.getMarkdown();
        const normalized = md.replace(/\n{3,}/g, '\n\n');
        this.sourceContent.set(normalized);
      }

      if (!p.sourceCodeMode && wasSource && muyaService.isReady()) {
        // Leaving source mode: push content back to Muya if changed
        const currentTabId = this.getActiveTabId();
        if (currentTabId) {
          const src = get(this.sourceContent);
          const currentMuya = muyaService.getMarkdown();
          if (src !== currentMuya) {
            muyaService.setMarkdown(src);
            editorStore.updateContent(currentTabId, src);
          }
        }
      }

      // Apply preferences to Muya
      if (muyaService.isReady()) {
        muyaService.applyPreferences(p);
      }
    }));

    // Per-tab readOnly: drives the .muya-readonly body class (CSS shim that
    // hides Muya's selection-driven floats and the markdown markers) and the
    // muya.blur() when entering read-only on the active tab. Muya has no
    // native readOnly mode, so we layer this on top.
    let prevReadOnly = false;
    unsubs.push(editorStore.activeTab.subscribe((tab) => {
      const readOnly = !!tab?.readOnly;
      document.body.classList.toggle('muya-readonly', readOnly);
      if (readOnly && !prevReadOnly && muyaService.isReady()) {
        try {
          const instance = muyaService.getInstance();
          if (instance) instance.blur(true, true);
        } catch (e) { console.warn('[EditorModes] blur failed:', e); }
      }
      prevReadOnly = readOnly;
    }));

    // Install read-only handlers
    this.installReadOnlyHandlers();

    return () => {
      unsubs.forEach((u) => u());
      this.removeReadOnlyHandlers();
    };
  }

  /** Toggles read-only mode on the active tab (no-op if no active tab). */
  toggleReadOnly(): void {
    editorStore.toggleActiveTabReadOnly();
  }

  /** Toggles source code mode; entering source disables focus and typewriter modes. */
  toggleSource(): void {
    const p = get(preferences);
    const patch: Partial<{ sourceCodeMode: boolean; focusMode: boolean; typewriterMode: boolean }> = {
      sourceCodeMode: !p.sourceCodeMode,
    };
    if (!p.sourceCodeMode) {
      // Entering source: disable incompatible modes
      patch.focusMode = false;
      patch.typewriterMode = false;
    }
    preferences.patch(patch);
  }

  /** Toggles the source/preview split view. */
  toggleSplit(): void {
    const p = get(preferences);
    preferences.patch({ splitView: !p.splitView });
  }

  /** Toggles focus mode (dims inactive paragraphs). */
  toggleFocus(): void {
    const p = get(preferences);
    preferences.patch({ focusMode: !p.focusMode });
  }

  /** Toggles typewriter mode (keeps cursor vertically centered). */
  toggleTypewriter(): void {
    const p = get(preferences);
    preferences.patch({ typewriterMode: !p.typewriterMode });
  }

  // --- Read-only event blocking ---

  private installReadOnlyHandlers(): void {
    // Prevent duplicate listeners if init() is called multiple times
    this.removeReadOnlyHandlers();

    this.readOnlyKeyHandler = (e: KeyboardEvent) => {
      if (!get(editorStore.activeTab)?.readOnly) return;
      const target = e.target as HTMLElement;
      if (target?.tagName === 'TEXTAREA') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'c' || e.key === 'a' || e.key === 'b' || e.key === ',')) return;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End'].includes(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    this.readOnlyInputHandler = (e: Event) => {
      if (!get(editorStore.activeTab)?.readOnly) return;
      const target = e.target as HTMLElement;
      if (target?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    document.addEventListener('keydown', this.readOnlyKeyHandler, true);
    document.addEventListener('beforeinput', this.readOnlyInputHandler, true);
    document.addEventListener('paste', this.readOnlyInputHandler, true);
  }

  private removeReadOnlyHandlers(): void {
    if (this.readOnlyKeyHandler) {
      document.removeEventListener('keydown', this.readOnlyKeyHandler, true);
    }
    if (this.readOnlyInputHandler) {
      document.removeEventListener('beforeinput', this.readOnlyInputHandler, true);
      document.removeEventListener('paste', this.readOnlyInputHandler, true);
    }
  }

  // --- Helpers ---

  private getActiveTabId(): string | null {
    return get(editorStore.activeTabId);
  }

  /** Returns a snapshot of the current editor mode state. */
  getState(): EditorState {
    return get(this.state);
  }
}

export const editorModes = new EditorModes();
