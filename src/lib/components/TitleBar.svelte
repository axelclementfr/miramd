<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { editor } from '$lib/stores/editor';
  import type { Tab } from '$lib/types/editor';

  interface Props {
    sidebarVisible: boolean;
    ontoggle: () => void;
  }

  let { sidebarVisible, ontoggle }: Props = $props();

  let activeTab: Tab | null = $state(null);
  let isMaximized: boolean = $state(false);
  let appWindow: any = null;
  let unsubs: (() => void)[] = [];

  onMount(() => {
    unsubs.push(editor.activeTab.subscribe((tab) => (activeTab = tab)));

    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        appWindow = getCurrentWindow();
        isMaximized = await appWindow.isMaximized();
        const unlistenResize = await appWindow.onResized(async () => {
          if (appWindow) isMaximized = await appWindow.isMaximized();
        });
        unsubs.push(unlistenResize);
      } catch (err) {
        console.error('Failed to initialize window controls:', err);
      }
    })();
  });

  onDestroy(() => unsubs.forEach((u) => u()));

  async function minimize() { await appWindow?.minimize(); }
  async function toggleMaximize() {
    await appWindow?.toggleMaximize();
    setTimeout(async () => { if (appWindow) isMaximized = await appWindow.isMaximized(); }, 100);
  }
  async function close() { await appWindow?.hide(); }

  function getTitle(): string {
    if (!activeTab) return 'MiraMD';
    return activeTab.name;
  }

  function getPathParts(): string[] {
    if (!activeTab?.path) return [];
    const parts = activeTab.path.split('/').filter(Boolean);
    return parts.slice(0, parts.length - 1).slice(-3);
  }

  async function startDrag(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.title-no-drag')) return;
    if (e.detail === 2) { await toggleMaximize(); }
    else { await appWindow?.startDragging(); }
  }
</script>

<div>
  <div class="title-bar-editor-bg"></div>
  <div class="title-bar" class:active={!!activeTab} role="presentation" onmousedown={startDrag}>
    <!-- MarkText: hamburger on far left, centered in the 45px icon column -->
    <div class="left-toolbar title-no-drag">
      <button
        class="frameless-titlebar-menu title-no-drag"
        class:active={sidebarVisible}
        onclick={ontoggle}
        title="Explorateur (Ctrl+B)"
      >
        <span>&#9776;</span>
      </button>
    </div>

    <div class="title">
      {#if !activeTab}
        <span></span>
      {:else}
        <span>
          {#each getPathParts() as part}
            <span class="path-part">{part}</span>
            <svg class="path-arrow" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          {/each}
          <span class="filename">{activeTab.name}</span>
          {#if activeTab.isModified}
            <span class="save-dot show"></span>
          {/if}
        </span>
      {/if}
    </div>

    <div class="right-toolbar title-no-drag">
      <button class="frameless-titlebar-button frameless-titlebar-close" onclick={close} title="Fermer">
        <div>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" fill="none"/>
          </svg>
        </div>
      </button>
      <button class="frameless-titlebar-button frameless-titlebar-toggle" onclick={toggleMaximize} title={isMaximized ? 'Restaurer' : 'Agrandir'}>
        <div>
          {#if isMaximized}
            <!-- Restore icon: two overlapping squares (Windows-style) -->
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M3 1h5.5a.5.5 0 01.5.5V7" stroke="currentColor" stroke-width="1" fill="none"/>
              <rect x="1" y="3" width="6" height="6" rx="0.5" stroke="currentColor" stroke-width="1" fill="none"/>
            </svg>
          {:else}
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" stroke="currentColor" stroke-width="1" fill="none"/>
            </svg>
          {/if}
        </div>
      </button>
      <button class="frameless-titlebar-button frameless-titlebar-minimize" onclick={minimize} title="Réduire">
        <div>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.2"/>
          </svg>
        </div>
      </button>
    </div>
  </div>
</div>

<style>
  .title-bar-editor-bg {
    height: var(--titleBarHeight, 32px);
    background: var(--bg-primary);
  }

  .title-bar {
    user-select: none;
    background: transparent;
    height: var(--titleBarHeight, 32px);
    box-sizing: border-box;
    color: var(--text-secondary);
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    z-index: 2;
    transition: color .4s ease-in-out;
    cursor: default;
  }

  .title-bar.active {
    color: var(--text-primary);
  }

  .title {
    padding: 0 142px;
    height: 100%;
    line-height: var(--titleBarHeight, 32px);
    font-size: 14px;
    text-align: center;
    transition: all .25s ease-in-out;
  }

  .title > span {
    display: block;
    direction: rtl;
    overflow: hidden;
    text-overflow: clip;
    white-space: nowrap;
  }

  .path-part { opacity: 0.5; font-size: 13px; }
  .path-arrow { opacity: 0.3; vertical-align: middle; margin: 0 1px; }
  .filename { transition: all .25s ease-in-out; font-size: 15px; }

  .save-dot {
    margin-left: 3px; width: 7px; height: 7px;
    display: inline-block; border-radius: 50%;
    background: var(--accent); opacity: .7; visibility: hidden;
  }
  .save-dot.show {
    visibility: visible;
    animation: dot-appear 0.2s ease-out;
  }

  @keyframes dot-appear {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  /* Left toolbar: just the hamburger, centered in 45px */
  .left-toolbar {
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    width: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .right-toolbar {
    height: 100%;
    position: absolute;
    top: 0;
    right: 0;
    width: 138px;
    display: flex;
    align-items: center;
    flex-direction: row-reverse;
  }

  .title-no-drag { -webkit-app-region: no-drag; }

  /* Hamburger — centered in 45px column, same axis as sidebar icons */
  .frameless-titlebar-menu {
    border: none;
    background: transparent;
    color: var(--sideBarColor, var(--text-secondary));
    cursor: default;
    font-size: 18px;
    width: 45px;
    height: var(--titleBarHeight, 32px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .frameless-titlebar-menu { transition: transform 0.1s ease; }
  .frameless-titlebar-menu:hover { color: var(--text-primary); }
  .frameless-titlebar-menu.active { color: var(--accent); }
  .frameless-titlebar-menu.active:hover { color: var(--accent-hover); }
  .frameless-titlebar-menu:active { transform: scale(0.85); }

  /* Window controls */
  .frameless-titlebar-button {
    position: relative;
    display: block;
    width: 46px;
    height: var(--titleBarHeight, 32px);
    border: none;
    background: transparent;
    color: var(--text-primary);
    cursor: default;
  }

  .frameless-titlebar-button > div {
    position: absolute;
    display: inline-flex;
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
  }

  .frameless-titlebar-close:hover { background-color: rgb(228, 79, 79); color: #fff; }
  .frameless-titlebar-minimize:hover,
  .frameless-titlebar-toggle:hover { background-color: rgba(128, 128, 128, 0.1); }
</style>
