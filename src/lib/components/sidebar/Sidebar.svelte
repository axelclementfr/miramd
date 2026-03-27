<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { uiActions } from '$lib/stores/uiActions';
  import FileTreePane from './FileTreePane.svelte';
  import SearchPane from './SearchPane.svelte';
  import TocPane from './TocPane.svelte';

  interface SidebarProps { onsettings?: () => void; ontoggle?: () => void; }
  let { onsettings, ontoggle }: SidebarProps = $props();

  const MIN_WIDTH = 230;
  const MAX_WIDTH = 1200;

  let rightColumn: 'files' | 'search' | 'toc' | '' = $state('files');
  let isDragging: boolean = $state(false);
  let sideBarViewWidth = $state(280);
  let fileTreePane: FileTreePane = $state(null as any);

  function handleLeftIconClick(name: 'files' | 'search' | 'toc') {
    rightColumn = rightColumn === name ? '' : name;
  }

  function onDragBarDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = sideBarViewWidth;
    let rafId = 0;
    let targetWidth = startWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    isDragging = true;

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      targetWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + ev.clientX - startX));
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          sideBarViewWidth = targetWidth;
          rafId = 0;
        });
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      isDragging = false;
      if (rafId) cancelAnimationFrame(rafId);
      sideBarViewWidth = targetWidth;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onDragBarKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 50 : 10;
    let next = sideBarViewWidth;
    if (e.key === 'ArrowLeft') next = sideBarViewWidth - step;
    else if (e.key === 'ArrowRight') next = sideBarViewWidth + step;
    else if (e.key === 'Home') next = MIN_WIDTH;
    else if (e.key === 'End') next = MAX_WIDTH;
    else return;
    e.preventDefault();
    sideBarViewWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next));
  }

  async function openFolder() {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true });
    if (selected) {
      rightColumn = 'files';
      await fileTreePane.openDirectory(selected as string);
    }
  }

  export async function openDirectory(dir: string) {
    rightColumn = 'files';
    await fileTreePane.openDirectory(dir);
  }

  onMount(() => {
    // Expose openFolder pour les context menus (FileTreePane, TabBar) qui en
    // ont besoin sans avoir de ref directe vers Sidebar.
    uiActions.update((a) => ({ ...a, openFolder }));
    return () => uiActions.update((a) => ({ ...a, openFolder: undefined }));
  });
</script>

<div
  class="side-bar"
  class:dragging={isDragging}
  style="width: {rightColumn ? Math.max(230, sideBarViewWidth) : 45}px;"
>
  <!-- Left icon column -->
  <div class="left-column">
    <ul>
      <li class:active={rightColumn === 'files'}>
        <button class="sidebar-icon-btn" onclick={() => handleLeftIconClick('files')} aria-label="Files">
        <svg viewBox="0 0 1024 1024" width="18" height="18">
          <path d="M963.2 796.8c0 22.4-12.8 70.4-73.6 70.4h-28.8V268.8c3.2-83.2-44.8-160-144-160H220.8v-16c0-51.2 28.8-80 76.8-80h512c96 0 156.8 76.8 156.8 166.4v617.6z" fill="currentColor"/>
          <path d="M806.4 940.8c0 22.4-12.8 70.4-73.6 70.4H147.2c-64 0-86.4-25.6-86.4-86.4V236.8c0-51.2 28.8-80 76.8-80h553.6c73.6 0 115.2 60.8 115.2 112v672z m-112-480c0-19.2-16-32-35.2-32H272c-19.2 0-35.2 16-35.2 32 0 19.2 16 32 35.2 32h387.2c19.2 0 35.2-16 35.2-32z m0 179.2c0-19.2-16-32-35.2-32H208c-19.2 0-35.2 16-35.2 32 0 19.2 16 32 35.2 32h451.2c19.2 0 35.2-12.8 35.2-32z m0 179.2c0-16-16-32-35.2-32H208c-19.2 0-35.2 12.8-35.2 32 0 16 16 32 35.2 32h451.2c19.2 0 35.2-12.8 35.2-32z" fill="currentColor"/>
        </svg>
        </button>
      </li>
      <li class:active={rightColumn === 'search'}>
        <button class="sidebar-icon-btn" onclick={() => handleLeftIconClick('search')} aria-label="Search">
        <svg viewBox="0 0 1024 1024" width="18" height="18">
          <path d="M999.68 880.213333l-249.173333-249.173333c41.813333-64 66.133333-140.8 66.133333-222.72C816.64 183.04 634.026667 0 408.32 0 183.04 0 0 183.04 0 408.32c0 225.706667 183.04 408.32 408.32 408.32 82.773333 0 160-24.746667 224.426667-67.413333l248.746666 248.746666c32.426667 32.426667 85.333333 32.426667 117.76 0 32.853333-32.426667 32.853333-85.333333 0.426667-117.76zM137.813333 408.32c0-150.613333 122.026667-272.64 272.64-272.64s272.64 122.026667 272.64 272.64-122.026667 272.64-272.64 272.64S137.813333 558.933333 137.813333 408.32z" fill="currentColor"/>
        </svg>
        </button>
      </li>
      <li class:active={rightColumn === 'toc'}>
        <button class="sidebar-icon-btn" onclick={() => handleLeftIconClick('toc')} aria-label="Table of contents">
        <svg viewBox="0 0 1024 1024" width="18" height="18">
          <path d="M146.285714 73.654857a73.142857 73.142857 0 1 1 146.285715 0v876.690286a73.142857 73.142857 0 1 1-146.285715 0V73.654857z m585.142857 0a73.142857 73.142857 0 1 1 146.285715 0v876.690286a73.142857 73.142857 0 1 1-146.285715 0V73.654857zM292.571429 438.857143h438.857142v146.285714H292.571429V438.857143z" fill="currentColor"/>
        </svg>
        </button>
      </li>
    </ul>
    <ul class="bottom">
      <li>
        <button class="sidebar-icon-btn" onclick={() => onsettings?.()} aria-label="Settings">
        <svg viewBox="0 0 1024 1024" width="18" height="18">
          <path d="M864.1024 557.1584c1.8944-14.7456 3.2768-29.4912 3.2768-45.1584 0-15.6672-1.3824-30.4128-3.2768-45.1584l99.9424-76.032a22.8352 22.8352 0 0 0 5.632-29.4912l-94.72-159.4368a24.1152 24.1152 0 0 0-28.8768-10.1376l-117.9648 46.08c-24.6272-18.432-51.2-33.6384-80.0256-45.1584l-18.0224-122.112A22.8864 22.8864 0 0 0 606.8736 51.2H417.3824a22.8864 22.8864 0 0 0-23.2448 19.3536l-17.9712 122.112a366.592 366.592 0 0 0-80.0768 45.1584l-117.9648-46.08a23.3984 23.3984 0 0 0-28.8768 10.1376l-94.72 159.4368a22.3232 22.3232 0 0 0 5.632 29.4912l99.9424 76.032a355.6352 355.6352 0 0 0-3.2768 45.1584c0 15.2064 1.3824 30.4128 3.2768 45.1584l-99.9424 76.032a22.8352 22.8352 0 0 0-5.632 29.4912l94.72 159.4368c5.632 10.1376 18.432 13.824 28.8768 10.1376l117.9648-46.08c24.6272 18.432 51.2 33.6384 80.0768 45.1584l17.9712 122.112a22.8864 22.8864 0 0 0 23.2448 19.3536h189.44a22.8864 22.8864 0 0 0 23.2448-19.3536l18.0224-122.112a366.592 366.592 0 0 0 80.0256-45.1584l117.9648 46.08c10.9056 4.1472 23.1936 0 28.8768-10.1376l94.72-159.4368a22.8352 22.8352 0 0 0-5.632-29.4912l-99.9424-76.032z m-352 116.1216c-91.4432 0-165.7856-72.3456-165.7856-161.28 0-88.9344 74.3424-161.28 165.7856-161.28S677.888 423.0656 677.888 512c0 88.9344-74.3424 161.28-165.7856 161.28z" fill="currentColor"/>
        </svg>
        </button>
      </li>
    </ul>
  </div>

  <!-- Right content column -->
  {#if rightColumn}
    <div class="right-column">
      {#key rightColumn}
      <div class="right-column-inner" transition:fly={{ x: -15, duration: 100 }}>
        {#if rightColumn === 'files'}
          <FileTreePane bind:this={fileTreePane} onopenFolder={openFolder} />
        {:else if rightColumn === 'search'}
          <SearchPane onopenFolder={openFolder} />
        {:else if rightColumn === 'toc'}
          <TocPane />
        {/if}
      </div>
      {/key}
    </div>
  {/if}

  <!-- Drag bar for resize — interactive separator (window splitter pattern) -->
  {#if rightColumn}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="drag-bar"
      role="separator"
      aria-orientation="vertical"
      aria-label="Sidebar width"
      aria-valuenow={sideBarViewWidth}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      tabindex="0"
      onmousedown={onDragBarDown}
      onkeydown={onDragBarKey}></div>
  {/if}
</div>

<style>
  .side-bar {
    display: flex;
    flex-shrink: 0;
    flex-grow: 0;
    height: 100%;
    position: relative;
    color: var(--sideBarColor, var(--text-secondary));
    user-select: none;
    -webkit-user-select: none;
    background: var(--bg-sidebar);
    animation: slideIn 150ms ease;
    transition: width 0.15s ease;
    overflow: hidden;
  }

  .side-bar.dragging { transition: none; }

  @keyframes slideIn { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  .left-column {
    height: 100%;
    width: 45px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-top: 40px;
    box-sizing: border-box;
    flex-shrink: 0;
  }

  .left-column ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
  }

  .left-column ul > li {
    width: 45px;
    height: 45px;
    margin: 0;
    padding: 0;
    display: flex;
    justify-content: space-around;
    align-items: center;
    cursor: default;
    color: var(--iconColor, var(--text-muted));
  }

  .sidebar-icon-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    width: 45px;
    height: 45px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: default;
    color: inherit;
  }

  .left-column ul > li > .sidebar-icon-btn > svg {
    width: 18px;
    height: 18px;
    opacity: 1;
    transition: transform .15s ease, color .15s ease;
  }

  .left-column ul > li:hover > .sidebar-icon-btn > svg { transform: scale(1.15); }
  .left-column ul > li:hover { color: var(--sideBarTitleColor, var(--text-primary)); }
  .left-column ul > li.active { color: var(--accent); }

  .right-column {
    width: calc(100% - 45px);
    min-width: calc(230px - 45px);
    overflow: hidden;
    position: relative;
    font-family: var(--font-family);
    flex-shrink: 0;
  }

  .right-column-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    overflow: hidden;
    padding-top: 35px;
  }

  .drag-bar {
    position: absolute;
    top: 0;
    right: -1px;
    bottom: 0;
    height: 100%;
    width: 3px;
    cursor: col-resize;
    background: transparent;
    z-index: 10;
  }

  .drag-bar:hover:not(:active) {
    background: var(--accent, var(--iconColor));
    opacity: 0.5;
  }

  .drag-bar:focus-visible {
    background: var(--accent, var(--iconColor));
    opacity: 1;
    width: 6px;
    right: -3px;
  }

  :global(.toc-highlight) { background: rgba(124, 156, 238, 0.2) !important; transition: background 0.3s ease; }
</style>
