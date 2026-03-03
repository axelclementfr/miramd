<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { editor as editorStore } from '$lib/stores/editor';
  import { preferences } from '$lib/stores/preferences';
  import { muyaService } from '$lib/services/muya';
  import { editorModes } from '$lib/services/editorModes';
  import { updateStats } from '$lib/services/stats';

  let readOnly: boolean = $state(false);
  let splitView: boolean = $state(false);
  let textareaEl: HTMLTextAreaElement = $state(null as any);
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let storeTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubs: (() => void)[] = [];

  onMount(() => {
    // Load content into textarea directly (uncontrolled)
    unsubs.push(editorModes.sourceContent.subscribe((c) => {
      // Only set value if textarea is not focused (user not typing)
      if (textareaEl && document.activeElement !== textareaEl) {
        textareaEl.value = c;
      }
    }));

    unsubs.push(preferences.subscribe((p) => {
      splitView = p.splitView;
    }));

    unsubs.push(editorStore.activeTab.subscribe((tab) => {
      readOnly = !!tab?.readOnly;
    }));
  });

  onDestroy(() => {
    unsubs.forEach((u) => u());
    if (syncTimer) clearTimeout(syncTimer);
    if (storeTimer) clearTimeout(storeTimer);
  });

  function handleInput() {
    const value = textareaEl.value;

    // Debounce store update — textarea is instant, store can wait
    if (storeTimer) clearTimeout(storeTimer);
    storeTimer = setTimeout(() => {
      editorModes.sourceContent.set(value);
      const tabId = get(editorStore.activeTabId);
      if (tabId) editorStore.updateContent(tabId, value);
      updateStats(value, true);
    }, 150);

    // Split mode: sync to Muya preview
    if (splitView && muyaService.isReady()) {
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        try { muyaService.setMarkdown(value); } catch (e) { console.debug('[SourcePane] split sync:', e); }
      }, 400);
    }
  }
</script>

<div class="source-pane">
  <textarea
    bind:this={textareaEl}
    class="source-code-editor"
    oninput={handleInput}
    spellcheck="true"
    readonly={readOnly}
  ></textarea>
</div>

<style>
  .source-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }
</style>
