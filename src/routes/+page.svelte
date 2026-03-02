<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { open } from '@tauri-apps/plugin-dialog';
  import { get } from 'svelte/store';
  import Sidebar from '$lib/components/sidebar/Sidebar.svelte';
  import TitleBar from '$lib/components/TitleBar.svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import SettingsModal from '$lib/components/settings/SettingsModal.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import WindowResizeEdges from '$lib/components/WindowResizeEdges.svelte';
  import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
  import { editor } from '$lib/stores/editor';
  import { preferences } from '$lib/stores/preferences';
  import { setLanguage, t, type TranslationKey } from '$lib/i18n/index';
  import { openFileDialog, saveCurrentFile, closeTabWithConfirm, openFileFromPath, getCurrentTabId, getCurrentTab } from '$lib/services/fileOperations';
  import { showToast } from '$lib/stores/toast';
  import { setupKeyboardShortcuts, zoomIn, zoomOut, resetZoom } from '$lib/services/shortcuts';
  import { startAutoSave } from '$lib/services/autoSave';
  import { initWindow } from '$lib/services/windowInit';
  import { SIDEBAR_WIDTH, MIN_WIDTH, MIN_HEIGHT, THEME_BG_MAP, DEFAULT_BG } from '$lib/constants';
  import '$lib/styles/global.css';
  import '$lib/styles/editor.css';
  import '$lib/styles/editor-layout.css';

  let sidebar: Sidebar | null = $state(null);
  let tr: (key: TranslationKey) => string = $state((k: TranslationKey) => k);
  let sidebarVisible: boolean = $state(false);
  let showTabBar: boolean = $state(true);
  let showStatusBar: boolean = $state(true);
  let hasActiveTab: boolean = $state(false);
  let settingsOpen: boolean = $state(false);
  let isMaximized: boolean = $state(false);

  let unsubs: (() => void)[] = [];

  onMount(async () => {
    await preferences.load();

    // Initial sync from stores
    unsubs.push(preferences.subscribe((p) => {
      sidebarVisible = p.sidebarVisible;
      showTabBar = p.showTabBar;
      showStatusBar = p.showStatusBar;
    }));
    unsubs.push(editor.activeTabId.subscribe((id) => (hasActiveTab = id !== null)));

    // Window init: dynamic min size + maximized state tracking
    const windowInit = await initWindow((maximized) => { isMaximized = maximized; });
    unsubs.push(windowInit.destroy);

    unsubs.push(preferences.subscribe((p) => {
      document.documentElement.setAttribute('data-theme', p.theme);
      document.documentElement.setAttribute('lang', p.language);
      setLanguage(p.language);
      // Apply editor preferences as CSS variables
      document.documentElement.style.setProperty('--font-size', `${Math.round((p.fontSize || 16) * (p.zoom || 1.0))}px`);
      document.documentElement.style.setProperty('--line-height', `${p.lineHeight}`);
      document.documentElement.style.setProperty('--font-family', p.fontFamily);
      // Sync background color to prevent white flash on resize (WebKitGTK issue)
      document.documentElement.style.setProperty('background-color', THEME_BG_MAP[p.theme] || DEFAULT_BG);
      document.body.style.setProperty('background-color', THEME_BG_MAP[p.theme] || DEFAULT_BG);

      // Hide scrollbar (body-level concern — CSS in global.css)
      document.body.classList.toggle('hide-scrollbar', p.hideScrollbar);
    }));

    // Auto-save
    const stopAutoSave = startAutoSave(
      () => get(preferences),
      () => { const tab = getCurrentTab(); if (tab?.isModified) saveCurrentFile(tr); },
    );
    unsubs.push(stopAutoSave);

    // Confirmation avant fermeture si fichier non sauvegardé
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Check if a file was passed via CLI (double-click .md from file manager)
    try {
      const cliFile = await invoke<string | null>('get_cli_file');
      if (cliFile) await openFileFromPath(cliFile, tr);
    } catch (err) {
      console.error('Failed to open CLI file:', err);
      showToast(tr('error_cli_file'), 'error');
    }

    // Listen for files opened from 2nd instance (single-instance plugin)
    const unlistenOpenFile = await listen<string>('open-file', (event) => openFileFromPath(event.payload, tr));
    unsubs.push(unlistenOpenFile);

    unsubs.push(t.subscribe((fn) => (tr = fn)));

    // App-level shortcuts (Ctrl+N, Ctrl+S, Ctrl+O, etc.)
    const removeShortcuts = setupKeyboardShortcuts({
      newFile: () => editor.addTab(),
      openFile: () => openFileDialog(tr),
      saveFile: () => saveCurrentFile(tr),
      closeTab: async () => { const id = getCurrentTabId(); if (id) await closeTabWithConfirm(id, tr); },
      toggleSidebar,
      openSettings: () => { settingsOpen = true; },
      zoomIn,
      zoomOut,
      resetZoom,
      isSettingsOpen: () => settingsOpen,
    });
    unsubs.push(removeShortcuts);
  });

  onDestroy(() => {
    unsubs.forEach((u) => u());
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (editor.hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = tr('unsaved_quit');
      return e.returnValue;
    }
  }

  let widthBeforeSidebar: number | null = null;

  async function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    preferences.patch({ sidebarVisible });

    try {
      const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const size = await win.innerSize();

      if (sidebarVisible) {
        const minWithSidebar = MIN_WIDTH + SIDEBAR_WIDTH;
        await win.setMinSize(new LogicalSize(minWithSidebar, MIN_HEIGHT));
        if (size.width < minWithSidebar) {
          widthBeforeSidebar = size.width;
          await win.setSize(new LogicalSize(size.width + SIDEBAR_WIDTH, size.height));
        } else {
          widthBeforeSidebar = null;
        }
      } else {
        await win.setMinSize(new LogicalSize(MIN_WIDTH, MIN_HEIGHT));
        if (widthBeforeSidebar !== null) {
          // Only restore if user hasn't manually resized wider than the auto-expanded size
          const autoExpandedWidth = widthBeforeSidebar + SIDEBAR_WIDTH;
          if (size.width <= autoExpandedWidth + 20) {
            await win.setSize(new LogicalSize(widthBeforeSidebar, size.height));
          }
          widthBeforeSidebar = null;
        }
      }
    } catch (e) { console.debug('[Sidebar] resize:', e); }
  }

  async function openFolderDialog() {
    const selected = await open({ directory: true });
    if (selected && sidebar) {
      sidebar.openDirectory(selected as string);
      if (!sidebarVisible) toggleSidebar();
    }
  }
</script>

<!-- MarkText-style layout: sidebar | editor-middle -->
<div class="editor-container">
  <WindowResizeEdges {isMaximized} />

  {#if sidebarVisible}
    <div class="sidebar-wrapper" transition:slide={{ duration: 150, axis: 'x' }}>
      <Sidebar bind:this={sidebar} onsettings={() => (settingsOpen = true)} ontoggle={toggleSidebar} />
    </div>
  {/if}

  <div class="editor-middle">
    <TitleBar {sidebarVisible} ontoggle={toggleSidebar} />

    {#if showTabBar}
      <div class="editor-tabs-wrapper">
        <TabBar />
      </div>
    {/if}

    {#if hasActiveTab}
      <div class="editor-area">
        <Editor />
      </div>
    {:else}
      <WelcomeScreen
        {tr}
        onNewFile={() => editor.addTab()}
        onOpenFile={() => openFileDialog(tr)}
        onOpenFolder={openFolderDialog}
        onOpenSettings={() => (settingsOpen = true)}
      />
    {/if}

    {#if showStatusBar}<StatusBar />{/if}
  </div>
</div>

<!-- Settings Modal -->
<SettingsModal open={settingsOpen} onclose={() => (settingsOpen = false)} />

<!-- Toast notifications -->
<Toast />

<style>
  /* MarkText-style layout: horizontal flex (sidebar | editor-middle) */
  .editor-container {
    display: flex;
    flex-direction: row;
    position: absolute;
    width: 100vw;
    height: 100vh;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .sidebar-wrapper {
    display: flex;
    flex-shrink: 0;
    height: 100%;
    overflow: hidden;
    background: var(--bg-sidebar);
  }

  /* Editor middle — MarkText exact layout */
  .editor-middle {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 100vh;
    position: relative;
    background: var(--bg-primary);
    min-width: 0;
  }

  .editor-tabs-wrapper {
    flex-shrink: 0;
  }

  .editor-area {
    flex: 1;
    overflow: hidden;
    display: flex;
  }
</style>
