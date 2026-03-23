<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, slide, fade } from 'svelte/transition';
  import { invokeWithTimeout } from '$lib/services/ipc';
  import { editor } from '$lib/stores/editor';
  import type { Tab } from '$lib/types/editor';
  import type { FileEntry, DirectoryListing, FolderNode, OpenedProject } from '$lib/types/filesystem';
  import { t, type TranslationKey } from '$lib/i18n/index';
  import { showToast } from '$lib/stores/toast';
  import fileIcons from '@marktext/file-icons';

  let openedProjects: OpenedProject[] = $state([]);
  let loading: boolean = $state(false);
  let openedTabs: Tab[] = $state([]);
  let activeTabId: string | null = $state(null);
  let openedFilesCollapsed: boolean = $state(false);

  let unsubs: (() => void)[] = [];
  let tr: (key: TranslationKey) => string = $state((k: TranslationKey) => k);

  onMount(() => {
    unsubs.push(t.subscribe((fn) => (tr = fn)));
    unsubs.push(editor.tabs.subscribe((tabs) => (openedTabs = tabs)));
    unsubs.push(editor.activeTabId.subscribe((id) => (activeTabId = id)));
  });

  onDestroy(() => unsubs.forEach((u) => u()));

  function selectOpenedTab(id: string) { editor.activeTabId.set(id); }

  function isActiveFile(path: string): boolean {
    const tab = openedTabs.find(t => t.id === activeTabId);
    return tab?.path === path;
  }

  async function saveAllTabs() {
    for (const tab of openedTabs) {
      if (tab.isModified && tab.path) {
        try {
          await invokeWithTimeout('write_file', { path: tab.path, content: tab.content });
          editor.markSaved(tab.id);
        } catch (err) {
          console.error('Failed to save file:', err);
          showToast(tr('error_save_file'), 'error');
        }
      }
    }
  }

  function closeProject(dir: string) {
    openedProjects = openedProjects.filter(p => p.dir !== dir);
  }

  async function closeAllTabs() {
    const tabsCopy = [...openedTabs];
    for (const tab of tabsCopy) {
      await closeOpenedTab(tab.id);
    }
  }

  async function closeOpenedTab(id: string) {
    const tab = openedTabs.find((t) => t.id === id);
    if (tab?.isModified) {
      const { message } = await import('@tauri-apps/plugin-dialog');
      const result = await message(
        `"${tab.name}" ${tr('unsaved_close')}`,
        { title: tr('unsaved_title'), kind: 'warning',
          buttons: { yes: tr('save_btn'), no: tr('discard_btn'), cancel: tr('cancel_btn') } }
      );
      if (result === 'Cancel') return;
      if (result === 'Yes' && tab.path) {
        try { await invokeWithTimeout('write_file', { path: tab.path, content: tab.content }); editor.markSaved(id); }
        catch (err) { console.error('Failed to save file:', err); showToast(tr('error_save_file'), 'error'); return; }
      }
    }
    editor.closeTab(id);
  }

  function buildFolderTree(entries: FileEntry[]): { folders: FolderNode[]; mdFiles: FileEntry[] } {
    const folders = entries.filter((e) => e.is_dir).map((e) => ({
      name: e.name, path: e.path, files: [], folders: [], collapsed: true,
    }));
    const mdFiles = entries.filter((e) => !e.is_dir);
    return { folders, mdFiles };
  }

  async function toggleFolder(folder: FolderNode) {
    if (folder.collapsed && folder.files.length === 0 && folder.folders.length === 0) {
      try {
        const listing = await invokeWithTimeout<DirectoryListing>('list_directory_entries', { dir: folder.path });
        const tree = buildFolderTree(listing.entries);
        folder.folders = tree.folders;
        folder.files = tree.mdFiles;
      } catch (err) {
        console.error('Failed to list directory:', err);
        showToast(tr('error_list_directory'), 'error');
      }
    }
    folder.collapsed = !folder.collapsed;
    openedProjects = [...openedProjects];
  }

  export async function openDirectory(dir: string) {
    if (openedProjects.some(p => p.dir === dir)) return;
    loading = true;
    try {
      const listing = await invokeWithTimeout<DirectoryListing>('list_directory_entries', { dir });
      const tree = buildFolderTree(listing.entries);
      const name = dir.split('/').pop() || dir;
      openedProjects = [...openedProjects, { dir, name, files: listing.entries.filter(e => !e.is_dir), folders: tree.folders, collapsed: false }];
    }
    catch (err) {
      console.error('Failed to list directory:', err);
      showToast(tr('error_list_directory'), 'error');
    }
    loading = false;
  }

  async function openFile(entry: FileEntry) {
    if (entry.is_dir) { await openDirectory(entry.path); return; }
    try {
      const file = await invokeWithTimeout<{ path: string; name: string; content: string; size: number }>('read_file', { path: entry.path });
      editor.addTab(file.path, file.name, file.content);
    } catch (err) {
      console.error('Failed to open file:', err);
      showToast(tr('error_open_file'), 'error');
    }
  }

  function getFileIconClasses(name: string): string {
    try {
      const icon = fileIcons.matchName(name);
      if (icon) return icon.getClass(0, false);
    } catch (e) { console.debug('[FileTree] icon:', e); }
    return 'icon-file-text';
  }

  interface Props { onopenFolder?: () => void; }
  let { onopenFolder }: Props = $props();
</script>

<div class="tree-view">
  <!-- OPENED FILES -->
  <div class="opened-files">
    <div class="of-title">
      <button class="tree-toggle-btn" onclick={() => (openedFilesCollapsed = !openedFilesCollapsed)} aria-label="Toggle opened files">
        <svg class="icon-arrow" class:collapsed={openedFilesCollapsed} width="10" height="10" viewBox="0 0 6 8">
          <polygon points="0,0 6,4 0,8" fill="currentColor"/>
        </svg>
        <span class="of-title-text">{tr('opened_files')}</span>
      </button>
      <a class="of-action" href={'#'} title={tr('save_all')} onclick={(e) => { e.preventDefault(); saveAllTabs(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
      </a>
      <a class="of-action" href={'#'} title={tr('close_all')} onclick={(e) => { e.preventDefault(); closeAllTabs(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </a>
    </div>
    {#if !openedFilesCollapsed}
      <div class="opened-files-list" transition:slide={{ duration: 200 }}>
        {#if openedTabs.length === 0}
          <div class="search-message-section" style="padding-top: {openedProjects.length === 0 ? '20px' : '0'};">{tr('no_open_files')}</div>
        {/if}
        {#each openedTabs as tab (tab.id)}
          <div class="opened-file" class:active={tab.id === activeTabId} class:unsaved={tab.isModified}
            onclick={() => selectOpenedTab(tab.id)} title={tab.path ?? tab.name}
            role="option" aria-selected={tab.id === activeTabId} tabindex="0"
            onkeydown={(e) => { if (e.key === 'Enter') selectOpenedTab(tab.id); }}
            transition:fly={{ x: -50, duration: 200 }}>
            <button class="of-close-btn" aria-label="Close tab" onclick={(e) => { e.stopPropagation(); closeOpenedTab(tab.id); }}>
              <svg class="of-close-icon" viewBox="0 0 12 12" width="10" height="10">
                <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/>
                <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.2"/>
              </svg>
            </button>
            <span class="of-name">{tab.name}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- PROJECT TREES -->
  {#each openedProjects as project (project.dir)}
    <div class="project-tree">
      <div class="pt-title">
        <button class="tree-toggle-btn" onclick={() => { project.collapsed = !project.collapsed; openedProjects = [...openedProjects]; }} aria-label="Toggle project">
          <svg class="icon-arrow" class:collapsed={project.collapsed} width="10" height="10" viewBox="0 0 6 8">
            <polygon points="0,0 6,4 0,8" fill="currentColor"/>
          </svg>
          <span class="pt-title-text">{project.name}</span>
        </button>
        <a class="of-action" href={'#'} title={tr('close_all')} onclick={(e) => { e.preventDefault(); closeProject(project.dir); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </a>
      </div>
      {#if !project.collapsed}
        <div class="tree-wrapper" transition:slide={{ duration: 200 }}>
          {#each project.folders as folder}
            {@render folderNode(folder, 0)}
          {/each}
          {#each project.files as file}
            <button class="side-bar-file" class:current={isActiveFile(file.path)} style="padding-left: 20px;"
              onclick={() => openFile(file)} title={file.name}>
              {@render fileIcon(file.name)}
              <span class="file-name">{file.name}</span>
            </button>
          {/each}
          {#if project.folders.length === 0 && project.files.length === 0}
            <div class="empty-project">
              <span>{tr('empty_project')}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/each}

  {#if loading}
    <div class="tree-skeleton">
      <div class="skeleton-line" style="width: 70%;"></div>
      <div class="skeleton-line" style="width: 55%;"></div>
      <div class="skeleton-line" style="width: 80%;"></div>
      <div class="skeleton-line" style="width: 45%;"></div>
      <div class="skeleton-line" style="width: 65%;"></div>
    </div>
  {:else if openedProjects.length === 0}
    <div class="open-project" transition:fade={{ duration: 200 }}>
      <div class="centered-group">
        <img src="/icons/illustrations/undraw_folder.svg" alt="" class="empty-illustration" />
        <button class="btn-open-folder" onclick={() => onopenFolder?.()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          {tr('open_folder')}
        </button>
      </div>
    </div>
  {/if}
</div>

{#snippet fileIcon(name: string)}
  <span class="file-icon-scope"><span class="icon {getFileIconClasses(name)}"></span></span>
{/snippet}

{#snippet folderNode(folder: FolderNode, depth: number)}
  <button class="side-bar-folder" style="padding-left: {depth * 20 + 20}px;" onclick={() => toggleFolder(folder)}>
    {#if folder.collapsed}
      <svg class="folder-icon" viewBox="0 0 1024 1024" width="16" height="16">
        <path d="M928.229 752.132c0 61.534-50.527 112.062-112.062 112.062L207.833 864.194c-61.534 0-112.062-50.527-112.062-112.062L95.771 271.868c0-61.534 50.528-112.062 112.062-112.062l160.088 0c61.534 0 112.062 50.528 112.062 112.062l0 16.009 336.185 0c61.534 0 112.062 50.528 112.062 112.062L928.23 752.132z" fill="currentColor"/>
      </svg>
    {:else}
      <svg class="folder-icon" viewBox="0 0 1097 1024" width="16" height="16">
        <path d="M1073.714286 544q0 17.714286-17.714286 37.714286l-192 226.285714q-24.571429 29.142857-68.857143 49.428571T713.142857 877.714286H91.428571q-19.428571 0-34.571428-7.428572T41.714286 845.714286q0-17.714286 17.714285-37.714286l192-226.285714q24.571429-29.142857 68.857143-49.428572T402.285714 512h621.714286q19.428571 0 34.571429 7.428571t15.142857 24.571429z m-196-196.571429v91.428572H402.285714q-53.714286 0-112.571428 27.142857T196 534.285714L3.428571 760.571429l-2.857142 3.428571q0-2.285714-0.285715-7.142857T0 749.714286V201.142857q0-52.571429 37.714286-90.285714t90.285714-37.714286h182.857143q52.571429 0 90.285714 37.714286t37.714286 90.285714v18.285714h310.857143q52.571429 0 90.285714 37.714286t37.714286 90.285714z" fill="currentColor"/>
      </svg>
    {/if}
    <span class="folder-name">{folder.name}</span>
  </button>
  {#if !folder.collapsed}
    <div class="folder-contents" transition:slide={{ duration: 150 }}>
      {#each folder.folders as sub}
        {@render folderNode(sub, depth + 1)}
      {/each}
      {#each folder.files as file}
        <button class="side-bar-file" class:current={isActiveFile(file.path)} style="padding-left: {(depth + 1) * 20 + 20}px;" onclick={() => openFile(file)}
          title={file.name}>
          {@render fileIcon(file.name)}
          <span class="file-name">{file.name}</span>
        </button>
      {/each}
    </div>
  {/if}
{/snippet}

<style>
  .tree-view {
    font-size: var(--font-size, 14px);
    font-family: var(--font-family);
    line-height: var(--line-height, 1.6);
    color: var(--sideBarColor, var(--text-secondary));
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .tree-toggle-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    flex: 1;
    cursor: default;
    color: inherit;
    font: inherit;
    min-width: 0;
  }

  .of-close-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    display: none;
    cursor: default;
    color: var(--sideBarColor, var(--text-muted));
    position: absolute;
    top: 9px;
    left: 10px;
    width: 10px;
    height: 10px;
  }

  .opened-file:hover > .of-close-btn { display: inline-block; }

  .opened-files { display: flex; flex-direction: column; }

  .of-title {
    height: 30px;
    line-height: 30px;
    font-size: inherit;
    padding: 0 13px;
    display: flex;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--bg-sidebar);
  }

  .of-title-text {
    flex: 1;
    cursor: default;
    user-select: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .of-action {
    display: none;
    text-decoration: none;
    color: var(--sideBarColor, var(--text-secondary));
    margin-left: 8px;
  }
  .of-title:hover .of-action,
  .pt-title:hover .of-action { display: block; }
  .of-action:hover { color: var(--accent); }

  .opened-files-list {
    max-height: 200px;
    overflow: auto;
    flex: 1;
  }
  .opened-files-list::-webkit-scrollbar:vertical { width: 8px; }

  .opened-file {
    display: flex;
    user-select: none;
    height: 28px;
    line-height: 28px;
    padding-left: 40px;
    position: relative;
    color: var(--sideBarColor, var(--text-secondary));
    cursor: default;
  }
  .opened-file:focus { outline: none; }
  .opened-file:hover { background: var(--sideBarItemHoverBgColor, var(--bg-hover)); }
  .opened-file.active { color: var(--accent); }

  .of-close-icon {
    width: 10px;
    height: 10px;
    cursor: default;
  }

  .opened-files-list .opened-file { transition: all .2s; }

  .of-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .opened-file.unsaved::before {
    content: '';
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent);
    position: absolute;
    top: 10px;
    left: 11px;
    animation: dot-appear 0.2s ease-out;
  }

  @keyframes dot-appear {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .opened-file.unsaved:hover::before { content: none; }

  .icon-arrow {
    flex-shrink: 0;
    margin-right: 5px;
    fill: var(--sideBarTextColor, var(--text-muted));
    transform: rotate(90deg);
    transition: all .25s ease-out;
    cursor: default;
  }
  .icon-arrow.collapsed { transform: rotate(0deg); }

  .project-tree { display: flex; flex-direction: column; }

  .pt-title {
    height: 30px;
    line-height: 30px;
    font-size: inherit;
    padding: 0 13px;
    display: flex;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--bg-sidebar);
  }

  .pt-title-text {
    flex: 1;
    cursor: default;
    user-select: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-wrapper { overflow: hidden; }
  .tree-wrapper::-webkit-scrollbar:vertical { width: 8px; }

  .side-bar-file {
    display: flex;
    position: relative;
    align-items: center;
    cursor: default;
    user-select: none;
    height: 30px;
    box-sizing: border-box;
    padding-right: 15px;
    color: var(--sideBarColor, var(--text-primary));
    background: none;
    border: none;
    font: inherit;
    width: 100%;
    text-align: left;
  }
  .side-bar-file:hover { background: var(--sideBarItemHoverBgColor, var(--bg-hover)); }

  :global(.file-icon-scope) {
    flex-shrink: 0;
    margin-right: 5px;
    line-height: 1;
  }

  .side-bar-file > .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .side-bar-file::before {
    content: '';
    position: absolute;
    display: block;
    left: 0;
    background: var(--accent);
    width: 2px;
    height: 0;
    top: 50%;
    transform: translateY(-50%);
    transition: all .2s ease;
  }
  .side-bar-file.current::before { height: 100%; }
  .side-bar-file.current > .file-name { color: var(--accent); }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .side-bar-folder {
    cursor: default;
    user-select: none;
    display: flex;
    align-items: center;
    height: 30px;
    padding-right: 15px;
    background: none;
    border: none;
    font: inherit;
    width: 100%;
    text-align: left;
    color: inherit;
  }
  .side-bar-folder:hover { background: var(--sideBarItemHoverBgColor, var(--bg-hover)); }

  .folder-icon {
    flex-shrink: 0;
    color: var(--iconColor, var(--text-muted));
    margin-right: 5px;
  }

  .folder-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: default;
  }

  .open-project {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 80%;
    text-align: center;
  }

  .centered-group {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .empty-project {
    position: absolute;
    top: 0;
    left: 0;
    font-size: inherit;
    display: flex;
    flex-direction: column;
    padding-top: 40px;
    align-items: center;
  }

  .empty-illustration {
    width: 120px;
    height: auto;
    opacity: 0.5;
  }

  .search-message-section {
    overflow-wrap: break-word;
    padding: 0 15px;
    margin-bottom: 5px;
    font-size: inherit;
    color: var(--sideBarColor, var(--text-secondary));
    text-align: center;
  }

  .btn-open-folder {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 7px 14px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--floatBgColor, var(--bg-secondary));
    color: var(--text-primary);
    cursor: pointer;
    font-size: 14px;
    font-family: var(--font-family);
    transition: all 150ms ease;
  }
  .btn-open-folder :global(svg) {
    flex-shrink: 0;
    display: inline-block;
    width: 16px;
    height: 16px;
    stroke: var(--text-primary);
  }
  .btn-open-folder:hover { transform: scale(1.05); }

  /* Loading skeleton */
  .tree-skeleton {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 15px 20px;
  }

  .skeleton-line {
    height: 12px;
    border-radius: 4px;
    background: var(--bg-hover, var(--bg-secondary));
    animation: skeleton-pulse 1.2s ease-in-out infinite;
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.6; }
  }
</style>
