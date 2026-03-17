import { writable, derived, get } from 'svelte/store';
import { preferences, type Preferences } from '$lib/stores/preferences';
import { editor as editorStore } from '$lib/stores/editor';
import { muyaService } from './muya';

export interface EditorState {
  readOnly: boolean;
  sourceCode: boolean;
  splitView: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
}

export type ModeKey = 'sourceCodeMode' | 'focusMode' | 'typewriterMode' | 'splitView';

type ModePrefs = Pick<Preferences,
  'sourceCodeMode' | 'focusMode' | 'typewriterMode' | 'splitView' | 'typewriterSounds'
>;

/**
 * Pure helper : compute the preferences patch to apply when toggling `mode`.
 * Encodes the mode-compatibility rules :
 *   - Activating sourceCodeMode disables focus, typewriter, typewriterSounds.
 *   - Deactivating sourceCodeMode disables splitView (split needs source).
 *   - Deactivating typewriter disables typewriterSounds.
 */
export function computeModeToggle(prefs: ModePrefs, mode: ModeKey): Partial<Preferences> {
  const next = !prefs[mode];
  const patch: Partial<Preferences> = { [mode]: next };

  if (mode === 'sourceCodeMode') {
    if (next) {
      patch.focusMode = false;
      patch.typewriterMode = false;
      patch.typewriterSounds = false;
    } else {
      patch.splitView = false;
    }
  }

  if (mode === 'typewriterMode' && !next) {
    patch.typewriterSounds = false;
  }

  return patch;
}

/**
 * Pure predicate : can the user toggle `mode` given the current prefs?
 *   - focusMode + typewriterMode require sourceCodeMode = false.
 *   - splitView requires sourceCodeMode = true.
 *   - sourceCodeMode is always toggleable.
 */
export function canToggleMode(prefs: Pick<Preferences, 'sourceCodeMode'>, mode: ModeKey): boolean {
  if (mode === 'focusMode' || mode === 'typewriterMode') return !prefs.sourceCodeMode;
  if (mode === 'splitView') return prefs.sourceCodeMode;
  return true;
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

  /** Toggles a mode (source/focus/typewriter/split) honoring compatibility rules. No-op if the mode is unavailable. */
  toggle(mode: ModeKey): void {
    const p = get(preferences);
    if (!canToggleMode(p, mode)) return;
    preferences.patch(computeModeToggle(p, mode));
  }

  toggleSource(): void { this.toggle('sourceCodeMode'); }
  toggleSplit(): void { this.toggle('splitView'); }
  toggleFocus(): void { this.toggle('focusMode'); }
  toggleTypewriter(): void { this.toggle('typewriterMode'); }

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
