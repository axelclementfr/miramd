import { get } from 'svelte/store';
import { preferences } from '$lib/stores/preferences';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, DEFAULT_ZOOM } from '$lib/constants';

export interface ShortcutHandlers {
  newFile: () => void;
  openFile: () => Promise<void>;
  saveFile: () => Promise<void>;
  closeTab: () => Promise<void>;
  toggleSidebar: () => void;
  openSettings: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  isSettingsOpen: () => boolean;
}

/**
 * Sets up global keyboard shortcuts (Ctrl+N, Ctrl+O, Ctrl+S, etc.).
 * Editor shortcuts (Ctrl+Z, Ctrl+A) are handled in MuyaPane directly.
 * Returns an unsubscribe function to remove the listener.
 */
export function setupKeyboardShortcuts(handlers: ShortcutHandlers): () => void {
  async function handleKeydown(e: KeyboardEvent): Promise<void> {
    if (handlers.isSettingsOpen()) return;

    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key === 'o') {
      e.preventDefault();
      await handlers.openFile();
    } else if (mod && e.key === 's') {
      e.preventDefault();
      await handlers.saveFile();
    } else if (mod && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) handlers.newFile();
      return;
    } else if (mod && e.key === 'w') {
      e.preventDefault();
      await handlers.closeTab();
    } else if (mod && e.key === 'b') {
      // Only toggle sidebar if editor doesn't have focus
      // Otherwise let Muya handle Ctrl+B for bold
      const editorEl = document.querySelector('[contenteditable="true"]');
      if (!editorEl || !editorEl.contains(document.activeElement)) {
        e.preventDefault();
        handlers.toggleSidebar();
      }
    } else if (mod && e.key === ',') {
      e.preventDefault();
      handlers.openSettings();
    } else if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      handlers.zoomIn();
    } else if (mod && e.key === '-') {
      e.preventDefault();
      handlers.zoomOut();
    } else if (mod && e.key === '0') {
      e.preventDefault();
      handlers.resetZoom();
    }
  }

  window.addEventListener('keydown', handleKeydown);
  return () => window.removeEventListener('keydown', handleKeydown);
}

/** Zoom in by one step, clamped to MAX_ZOOM */
export function zoomIn(): void {
  const p = get(preferences);
  preferences.patch({ zoom: Math.min(MAX_ZOOM, Math.round((p.zoom + ZOOM_STEP) * 10) / 10) });
}

/** Zoom out by one step, clamped to MIN_ZOOM */
export function zoomOut(): void {
  const p = get(preferences);
  preferences.patch({ zoom: Math.max(MIN_ZOOM, Math.round((p.zoom - ZOOM_STEP) * 10) / 10) });
}

/** Reset zoom to default (1.0) */
export function resetZoom(): void {
  preferences.patch({ zoom: DEFAULT_ZOOM });
}
