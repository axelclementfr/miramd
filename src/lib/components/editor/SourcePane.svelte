<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { editor as editorStore } from '$lib/stores/editor';
  import { preferences } from '$lib/stores/preferences';
  import { muyaService } from '$lib/services/muya';
  import { editorModes } from '$lib/services/editorModes';
  import { updateStats } from '$lib/services/stats';
  import { dlog } from '$lib/services/debug';
  import { computeAnchoredScroll, type ScrollAnchor } from '$lib/services/splitScrollSync';
  import { extractHeadings } from '$lib/services/toc';

  let readOnly: boolean = $state(false);
  let splitView: boolean = $state(false);
  let textareaEl: HTMLTextAreaElement = $state(null as any);
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let storeTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollSyncRaf = 0;
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
    if (scrollSyncRaf) cancelAnimationFrame(scrollSyncRaf);
  });

  /** Returns the computed target scrollTop, or null if sync couldn't run. */
  function syncPreviewTo(srcCharPos: number, smooth: boolean): { pane: HTMLElement; target: number } | null {
    const previewPane = document.querySelector('.wysiwyg-pane') as HTMLElement | null;
    if (!previewPane || !textareaEl) return null;

    const source = textareaEl.value;
    const dstMax = previewPane.scrollHeight - previewPane.clientHeight;

    const headings = extractHeadings(source);
    const previewHeadings = previewPane.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const n = Math.min(headings.length, previewHeadings.length);
    const anchors: ScrollAnchor[] = [];
    for (let i = 0; i < n; i++) {
      anchors.push({
        srcPos: headings[i].pos,
        dstTop: (previewHeadings[i] as HTMLElement).offsetTop,
      });
    }

    const target = computeAnchoredScroll(
      srcCharPos,
      source.length,
      anchors,
      dstMax,
      previewPane.scrollHeight,
    );

    if (smooth) {
      previewPane.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      previewPane.scrollTop = target;
    }

    return { pane: previewPane, target };
  }

  function flashClickMarker(pane: HTMLElement, scrollTop: number) {
    const marker = document.createElement('div');
    marker.className = 'split-click-marker';
    // Position the marker just below the would-be top of the visible viewport
    // after smooth scroll lands. +6 gives a small visual offset so it doesn't
    // ride exactly on the edge.
    marker.style.top = `${scrollTop + 6}px`;
    pane.appendChild(marker);
    setTimeout(() => marker.remove(), 1300);
  }

  function handleScroll() {
    if (!splitView) return;
    if (scrollSyncRaf) return; // already scheduled this frame
    scrollSyncRaf = requestAnimationFrame(() => {
      scrollSyncRaf = 0;
      if (!textareaEl) return;
      const srcCharPos = textareaEl.scrollHeight > 0
        ? Math.round((textareaEl.scrollTop / textareaEl.scrollHeight) * textareaEl.value.length)
        : 0;
      syncPreviewTo(srcCharPos, false);
    });
  }

  function handleClick() {
    if (!splitView) return;
    if (!textareaEl) return;
    const result = syncPreviewTo(textareaEl.selectionStart, true);
    if (result) flashClickMarker(result.pane, result.target);
  }

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
        try { muyaService.setMarkdown(value); } catch (e) { dlog('muya', 'SourcePane split sync:', e); }
      }, 400);
    }
  }
</script>

<div class="source-pane">
  <textarea
    bind:this={textareaEl}
    class="source-code-editor"
    oninput={handleInput}
    onscroll={handleScroll}
    onclick={handleClick}
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
