<script lang="ts">
  import { fly } from 'svelte/transition';
  import { onMount, onDestroy } from 'svelte';
  import { editor } from '$lib/stores/editor';
  import type { Tab } from '$lib/types/editor';
  import { invokeWithTimeout } from '$lib/services/ipc';
  import { message } from '@tauri-apps/plugin-dialog';
  import { showToast } from '$lib/stores/toast';
  import { t, type TranslationKey } from '$lib/i18n/index';
  import { computeTabWheelScroll } from '$lib/services/tabWheelScroll';
  import { buildContextMenuItems } from '$lib/services/contextMenuItems';
  import ContextMenu, { type ContextMenuItem } from '$lib/components/ContextMenu.svelte';

  let tabs: Tab[] = $state([]);
  let activeTabId: string | null = $state(null);
  let tr: (key: TranslationKey) => string = $state((k: TranslationKey) => k);
  let unsubs: (() => void)[] = [];

  onMount(() => {
    unsubs.push(editor.tabs.subscribe((t) => (tabs = t)));
    unsubs.push(editor.activeTabId.subscribe((id) => (activeTabId = id)));
    unsubs.push(t.subscribe((fn) => (tr = fn)));
  });

  onDestroy(() => unsubs.forEach((u) => u()));

  function selectTab(id: string) {
    editor.activeTabId.set(id);
  }

  async function closeTab(e: MouseEvent, id: string) {
    e.stopPropagation();
    const tab = tabs.find((t) => t.id === id);
    if (tab?.isModified) {
      const result = await message(
        `"${tab.name}" ${tr('unsaved_close')}`,
        {
          title: tr('unsaved_title'),
          kind: 'warning',
          buttons: {
            yes: tr('save_btn'),
            no: tr('discard_btn'),
            cancel: tr('cancel_btn'),
          },
        }
      );
      if (result === 'Cancel') return;
      if (result === 'Yes') {
        if (tab.path) {
          try {
            await invokeWithTimeout('write_file', { path: tab.path, content: tab.content });
            editor.markSaved(id);
          } catch (err) {
            console.error('Save failed:', err);
            showToast(tr('error_save_file'), 'error');
            return;
          }
        }
      }
    }
    editor.closeTab(id);
  }

  function handleMiddleClick(e: MouseEvent, id: string) {
    if (e.button === 1) {
      closeTab(e, id);
    }
  }

  let ctxMenuPos: { x: number; y: number } | null = $state(null);
  let ctxMenuItems: ContextMenuItem[] = $state([]);

  function openCtxMenu(e: MouseEvent, tabId: string) {
    e.preventDefault();
    e.stopPropagation();
    ctxMenuItems = buildContextMenuItems({ tr, tabId });
    ctxMenuPos = { x: e.clientX, y: e.clientY };
  }
  function closeCtxMenu() { ctxMenuPos = null; }

  function handleWheel(e: WheelEvent) {
    const el = e.currentTarget as HTMLDivElement;
    const r = computeTabWheelScroll({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      deltaY: e.deltaY,
      deltaX: e.deltaX,
    });
    if (r.preventDefault) e.preventDefault();
    if (r.newScrollLeft !== el.scrollLeft) el.scrollLeft = r.newScrollLeft;
  }
</script>

<div class="editor-tabs">
  <div class="scrollable-tabs" onwheel={handleWheel}>
    <ul class="tabs-container">
      {#each tabs as tab (tab.id)}
        <li
          transition:fly={{ y: -20, duration: 150 }}
          class:active={tab.id === activeTabId}
          class:unsaved={tab.isModified}
          title={tab.path ?? tab.name}
          onclick={() => selectTab(tab.id)}
          onkeydown={(e) => { if (e.currentTarget !== e.target) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTab(tab.id); } }}
          onauxclick={(e) => handleMiddleClick(e, tab.id)}
          oncontextmenu={(e) => openCtxMenu(e, tab.id)}
          role="tab"
          tabindex="0"
        >
          {#if tab.isModified}<span class="modified-dot"></span>{/if}
          <span>{tab.name}</span>
          <button class="close-btn" aria-label="Close tab" onclick={(e) => closeTab(e, tab.id)}>
          <svg class="close-icon" viewBox="0 0 12 12" width="12" height="12">
            <circle class="unsaved-circle" cx="6" cy="6" r="3"/>
            <g class="close-x">
              <line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.2"/>
              <line x1="3" y1="9" x2="9" y2="3" stroke="currentColor" stroke-width="1.2"/>
            </g>
          </svg>
          </button>
        </li>
      {/each}
    </ul>
  </div>
  <button class="new-file" onclick={() => editor.addTab()} title="Nouveau fichier (Ctrl+N)">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  </button>
</div>

<ContextMenu position={ctxMenuPos} items={ctxMenuItems} onclose={closeCtxMenu} />

<style>
  /* MarkText exact tab styling */
  .close-icon .unsaved-circle {
    fill: var(--accent);
  }

  .editor-tabs {
    position: relative;
    display: flex;
    flex-direction: row;
    height: 35px;
    user-select: none;
    box-shadow: none;
    overflow: hidden;
  }

  .editor-tabs:hover > .new-file {
    opacity: 1 !important;
  }

  .scrollable-tabs {
    flex: 0 1 auto;
    height: 35px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .scrollable-tabs::-webkit-scrollbar {
    display: none;
  }

  .tabs-container {
    min-width: min-content;
    list-style: none;
    margin: 0;
    padding: 0;
    height: 35px;
    position: relative;
    display: flex;
    flex-direction: row;
    overflow-y: hidden;
    z-index: 2;
  }

  .tabs-container > li {
    position: relative;
    padding: 0 8px;
    color: var(--text-secondary);
    font-size: 12px;
    font-family: var(--font-family);
    line-height: 35px;
    height: 35px;
    max-width: 280px;
    background: var(--floatBgColor, var(--bg-tab));
    display: flex;
    align-items: center;
    cursor: default;
  }

  .tabs-container > li:focus {
    outline: none;
  }

  .close-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    cursor: pointer;
    opacity: 0;
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .tabs-container > li:hover .close-btn {
    opacity: 1;
  }

  /* When hovering, show X and hide unsaved circle */
  .tabs-container > li:hover .close-btn .close-x {
    display: block !important;
  }
  .tabs-container > li:hover .close-btn .unsaved-circle {
    display: none !important;
  }

  .tabs-container > li > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 3px;
  }

  /* Unsaved (non-active): keep close icon hidden until hover */

  /* Active tab — same color as titlebar/editor background */
  .tabs-container > li.active {
    background: var(--bg-primary);
    z-index: 3;
    font-weight: 600;
  }

  /* No bottom bar on active tab — MarkText uses background change only */

  .tabs-container > li.active .close-btn {
    opacity: 1;
  }

  .tabs-container > li.active .close-btn .unsaved-circle {
    display: none;
  }

  /* Default: show close-x, hide unsaved-circle */
  .close-icon .close-x { display: block; }
  .close-icon .unsaved-circle { display: none; }

  .new-file {
    flex: 0 0 35px;
    width: 35px;
    height: 35px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: space-around;
    cursor: pointer;
    color: var(--text-secondary);
    opacity: 1;
    border: none;
    padding: 0;
  }

  .new-file:hover {
    color: var(--text-primary);
  }

  /* Modified file indicator dot */
  .modified-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    margin-right: 4px;
    animation: dot-appear 0.2s ease-out;
  }

  @keyframes dot-appear {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>
