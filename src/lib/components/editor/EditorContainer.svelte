<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { preferences } from '$lib/stores/preferences';
  import { editor as editorStore } from '$lib/stores/editor';
  import { editorModes } from '$lib/services/editorModes';
  import { muyaService } from '$lib/services/muya';
  import MuyaPane from './MuyaPane.svelte';
  import SourcePane from './SourcePane.svelte';
  import LockToggle from './LockToggle.svelte';

  let sourceCodeMode: boolean = $state(false);
  let splitView: boolean = $state(false);
  let readOnly: boolean = $state(false);
  let loading: boolean = $state(true);

  let cleanupModes: (() => void) | null = null;
  let unsubs: (() => void)[] = [];

  onMount(() => {
    // Initialize mode tracking (read-only handlers, source mode transitions)
    cleanupModes = editorModes.init();

    unsubs.push(preferences.subscribe((p) => {
      sourceCodeMode = p.sourceCodeMode;
      splitView = p.splitView;
      readOnly = p.readOnly;
    }));

    // Show loading briefly on initial mount and tab switch
    let prevTabId: string | null = null;
    unsubs.push(editorStore.activeTab.subscribe((tab) => {
      if (tab && tab.id !== prevTabId) {
        loading = true;
        prevTabId = tab.id;
        // Hide loading once Muya has had time to render
        setTimeout(() => { loading = false; }, 80);
      }
    }));

    // Initial load: hide once Muya is ready
    setTimeout(() => { loading = false; }, 120);
  });

  onDestroy(() => {
    cleanupModes?.();
    unsubs.forEach((u) => u());
  });
</script>

<div
  class="editor-container"
  class:source-active={sourceCodeMode}
  class:split-active={sourceCodeMode && splitView}
  class:read-only={readOnly}
>
  {#if loading}
    <div class="editor-loading">
      <div class="editor-loading-bar"></div>
    </div>
  {/if}

  {#if sourceCodeMode}
    <SourcePane />
  {/if}

  <MuyaPane />

  <LockToggle />
</div>

<style>
  .editor-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .editor-container.read-only {
    opacity: 0.92;
  }

  .editor-container.split-active {
    flex-direction: row;
  }

  /* Loading indicator — subtle top bar */
  .editor-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    z-index: 10;
    overflow: hidden;
  }

  .editor-loading-bar {
    width: 40%;
    height: 100%;
    background: var(--accent);
    opacity: 0.7;
    animation: editor-loading-slide 0.8s ease-in-out infinite;
  }

  @keyframes editor-loading-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }

  /* Split mode: source pane gets a right border */
  :global(.split-active .source-pane) {
    border-right: 1px solid var(--border);
  }

  /* Read-only, Muya padding, float menus, and table picker styles
     are in editor-layout.css (imported globally in +page.svelte) */
</style>
