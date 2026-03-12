import { get } from 'svelte/store';
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
