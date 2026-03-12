<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { debugFlags, ALL_SUBJECTS, type DebugSubject } from '$lib/stores/debug';
  import { setDebugFlag, debugPanelOpen } from '$lib/services/debug';

  let open: boolean = $state(false);
  let flags: Record<DebugSubject, boolean> = $state(
    {} as Record<DebugSubject, boolean>
  );

  let unsubs: (() => void)[] = [];

  onMount(() => {
    unsubs.push(debugPanelOpen.subscribe((v) => (open = v)));
    unsubs.push(debugFlags.subscribe((f) => (flags = { ...f })));
  });

  onDestroy(() => unsubs.forEach((u) => u()));

  function toggle(subject: DebugSubject): void {
    setDebugFlag(subject, !flags[subject]);
  }

  function disableAll(): void {
    for (const s of ALL_SUBJECTS) {
      if (flags[s]) setDebugFlag(s, false);
    }
  }

  function close(): void {
    debugPanelOpen.set(false);
  }
</script>

{#if open}
  <div class="debug-panel" role="dialog" aria-label="Debug panel">
    <header>
      <strong>Debug</strong>
      <button class="close" onclick={close} aria-label="Close">×</button>
    </header>
    <ul>
      {#each ALL_SUBJECTS as subject}
        <li>
          <label>
            <input
              type="checkbox"
              checked={flags[subject] ?? false}
              onchange={() => toggle(subject)}
            />
            {subject}
          </label>
        </li>
      {/each}
    </ul>
    <footer>
      <button onclick={disableAll}>Disable all</button>
    </footer>
  </div>
{/if}

<style>
  .debug-panel {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 9999;
    background: var(--bg-secondary, #1e1e1e);
    color: var(--text-primary, #ddd);
    border: 1px solid var(--border-primary, #444);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    padding: 8px 12px;
    font-size: 12px;
    min-width: 180px;
    font-family: ui-monospace, monospace;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border-primary, #444);
    margin-bottom: 6px;
  }
  .close {
    background: none;
    border: none;
    color: inherit;
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    padding: 2px 0;
  }
  label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  footer {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border-primary, #444);
    text-align: right;
  }
  footer button {
    background: none;
    border: 1px solid var(--border-primary, #444);
    color: inherit;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
  }
  footer button:hover {
    background: var(--bg-hover, #2a2a2a);
  }
</style>
