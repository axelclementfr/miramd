import { get, writable } from 'svelte/store';
import {
  debugFlags,
  persistFlags,
  type DebugSubject,
} from '$lib/stores/debug';

/**
 * Verbose log gated by per-subject flag.
 * No-op when the flag is off — safe to leave in production code.
 */
export function dlog(subject: DebugSubject, ...args: unknown[]): void {
  const flags = get(debugFlags);
  if (!flags[subject]) return;
  // eslint-disable-next-line no-console
  console.log(`[${subject}]`, ...args);
}

/**
 * Toggle a debug subject. Persists to localStorage immediately.
 */
export function setDebugFlag(subject: DebugSubject, enabled: boolean): void {
  debugFlags.update((flags) => {
    const next = { ...flags, [subject]: enabled };
    persistFlags(next);
    return next;
  });
}

export const debugPanelOpen = writable<boolean>(false);

/**
 * Wire Ctrl+Shift+D to toggle the debug panel.
 * Returns an unsubscribe function to remove the listener.
 */
export function setupDebugShortcut(): () => void {
  function handler(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      debugPanelOpen.update((v) => !v);
    }
  }
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
