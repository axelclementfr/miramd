<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { editor } from '$lib/stores/editor';

  let readOnly: boolean = $state(false);
  let unsub: (() => void) | null = null;

  onMount(() => {
    unsub = editor.activeTab.subscribe((tab) => { readOnly = !!tab?.readOnly; });
  });

  onDestroy(() => unsub?.());

  function toggle() {
    editor.toggleActiveTabReadOnly();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="lock-toggle"
  class:locked={readOnly}
  onclick={toggle}
  title={readOnly ? 'Mode lecture seule — cliquer pour éditer' : 'Mode édition — cliquer pour verrouiller'}
>
  {#if readOnly}
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  {:else}
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
  {/if}
</div>

<style>
  .lock-toggle {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 100;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-muted);
    background: transparent;
    transition: all 0.15s ease;
    opacity: 0.4;
  }

  .lock-toggle:hover {
    opacity: 1;
    background: var(--bg-hover, rgba(255,255,255,0.05));
  }

  .lock-toggle.locked {
    opacity: 0.8;
    color: var(--accent, #7c9cee);
  }
</style>
