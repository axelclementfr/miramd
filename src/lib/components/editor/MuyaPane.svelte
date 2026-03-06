<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import { editor as editorStore } from '$lib/stores/editor';
  import { preferences } from '$lib/stores/preferences';
  import { muyaService } from '$lib/services/muya';
  import { editorModes } from '$lib/services/editorModes';
  import { updateStats } from '$lib/services/stats';
  import { zoomService } from '$lib/services/zoom';
  import { fontSizeService } from '$lib/services/fontSize';
  import { lineNumbersService } from '$lib/services/lineNumbers';
  import { historyCache } from '$lib/services/historyCache';
  import { initTypewriterScroller } from '$lib/services/typewriterScroller';

  let editorElement: HTMLDivElement = $state(null as any);
  let paneElement: HTMLDivElement = $state(null as any);
  let hidden: boolean = $state(false);
  let sourceCodeMode: boolean = $state(false);
  let splitView: boolean = $state(false);
  let readOnly: boolean = $state(false);
  let typewriterMode: boolean = $state(false);

  let loadingTab = true;
  let unsubs: (() => void)[] = [];


  onMount(() => {
    const prefs = get(preferences);

    // Initialize Muya via service
    const editor = muyaService.init(editorElement, prefs);
    if (!editor) return;

    // Suppress change events during initial load
    setTimeout(() => { loadingTab = false; }, 50);

    // Initialize zoom (app-wide WebKit zoom), editor font size, and line numbers
    zoomService.init();
    fontSizeService.init();
    lineNumbersService.init(paneElement);

    // Editor keyboard shortcuts — capture phase to intercept before WebKitGTK.
    // WebKitGTK does NOT support native contenteditable undo (unlike Chromium/Electron),
    // so we must intercept Ctrl+Z/Y and call Muya's undo/redo explicitly.
    const editorKeydown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        invoke('debug_log', { message: `Ctrl+Z → muya.undo()` });
        muyaService.undo();
      } else if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        invoke('debug_log', { message: `Ctrl+Shift+Z → muya.redo()` });
        muyaService.redo();
      } else if (e.key === 'y') {
        e.preventDefault();
        e.stopPropagation();
        invoke('debug_log', { message: `Ctrl+Y → muya.redo()` });
        muyaService.redo();
      } else if (e.key === 'a') {
        e.preventDefault();
        e.stopPropagation();
        muyaService.selectAll();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        e.stopImmediatePropagation();
        muyaService.shiftHeadingUp();
      } else if (e.key === '-') {
        e.preventDefault();
        e.stopImmediatePropagation();
        muyaService.shiftHeadingDown();
      } else if (e.key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation();
        muyaService.resetToParagraph();
      }
    };
    paneElement.addEventListener('keydown', editorKeydown, true);
    unsubs.push(() => paneElement.removeEventListener('keydown', editorKeydown, true));

    // contenteditable depends on per-tab readOnly + global source/split
    function applyEditable() {
      const editable = paneElement?.querySelector('[contenteditable]') as HTMLElement;
      if (editable) {
        editable.setAttribute('contenteditable', String(!(readOnly || (sourceCodeMode && splitView))));
      }
    }

    // Subscribe to preferences for global modes
    unsubs.push(preferences.subscribe((p) => {
      sourceCodeMode = p.sourceCodeMode;
      splitView = p.splitView;
      typewriterMode = p.typewriterMode;
      hidden = p.sourceCodeMode && !p.splitView;
      applyEditable();
    }));

    // Subscribe to active tab for per-tab readOnly
    unsubs.push(editorStore.activeTab.subscribe((tab) => {
      readOnly = !!tab?.readOnly;
      applyEditable();
    }));

    // Content changes -> store (debounced for performance)
    let contentTimer: ReturnType<typeof setTimeout> | null = null;
    let statsTimer: ReturnType<typeof setTimeout> | null = null;

    unsubs.push(muyaService.onChange((changes: any) => {
      if (loadingTab || readOnly) return;
      if (sourceCodeMode && !splitView) return;

      // Capture tabId NOW, not when the timer fires
      const tabId = get(editorStore.activeTabId);
      if (!tabId) return;

      // Debounce content update (100ms)
      if (contentTimer) clearTimeout(contentTimer);
      contentTimer = setTimeout(() => {
        // Verify we're still on the same tab
        if (get(editorStore.activeTabId) !== tabId) return;
        const md = changes.markdown || muyaService.getMarkdown();
        editorStore.updateContent(tabId, md);
      }, 100);

      // Debounce stats update (300ms)
      if (statsTimer) clearTimeout(statsTimer);
      statsTimer = setTimeout(() => {
        const md = changes.markdown || muyaService.getMarkdown();
        updateStats(md, false);
      }, 300);
    }));

    // Typewriter mode: keep cursor vertically centered (throttled)
    const twCleanups = initTypewriterScroller(
      () => paneElement,
      () => typewriterMode
    );
    unsubs.push(...twCleanups);

    // Tab switching — save/restore Muya state (cursor + history) per tab.
    // This is how MarkText does it: Muya owns undo/redo, we just persist it.
    const muya = muyaService.getInstance();
    let prevTabId: string | null = null;
    unsubs.push(editorStore.activeTab.subscribe((tab) => {
      if (!tab || !muya) return;
      if (tab.id !== prevTabId) {
        // Cancel pending timers to prevent cross-tab content pollution
        if (contentTimer) { clearTimeout(contentTimer); contentTimer = null; }
        if (statsTimer) { clearTimeout(statsTimer); statsTimer = null; }

        // Save history of the tab we're leaving
        if (prevTabId) {
          try { historyCache.set(prevTabId, muya.getHistory()); } catch (e) { console.debug('[Muya] getHistory:', e); }
        }

        prevTabId = tab.id;
        loadingTab = true;

        // Load new tab content
        muya.setMarkdown(tab.content);

        // Restore history if available, otherwise start fresh
        const cached = historyCache.get(tab.id);
        if (cached) {
          try { muya.setHistory(cached); } catch { muya.clearHistory(); }
        } else {
          muya.clearHistory();
        }

        if (!tab.isModified) {
          try { editorStore.markSaved(tab.id, muya.getMarkdown()); } catch (e) { console.warn('[Muya] markSaved sync:', e); }
        }
        setTimeout(() => { loadingTab = false; }, 50);
      }
    }));

    // Clean up cache when tab is closed
    unsubs.push(editorStore.tabs.subscribe((tabs) => {
      historyCache.cleanUp(new Set(tabs.map((t) => t.id)));
    }));

    // Focus the editor
    setTimeout(() => { muyaService.focus(); }, 100);
  });

  onDestroy(() => {
    unsubs.forEach((u) => u());
    zoomService.destroy();
    fontSizeService.destroy();
    lineNumbersService.destroy();
    muyaService.destroy();
  });
</script>

<div class="wysiwyg-pane" class:hidden bind:this={paneElement}>
  <div bind:this={editorElement} class="muya-editor"></div>
</div>

<style>
  .wysiwyg-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--editorBgColor, var(--bg-primary));
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
  }

  .wysiwyg-pane.hidden {
    display: none;
  }

  /* Muya replaces our div -- takes full width, height auto */
  .muya-editor,
  :global(.wysiwyg-pane > div) {
    width: 100%;
    min-height: 100%;
    box-sizing: border-box;
  }
</style>
