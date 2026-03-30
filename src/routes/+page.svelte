<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { invokeWithTimeout } from '$lib/services/ipc';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { open } from '@tauri-apps/plugin-dialog';
  import { get } from 'svelte/store';
  import Sidebar from '$lib/components/sidebar/Sidebar.svelte';
  import TitleBar from '$lib/components/TitleBar.svelte';
  import TabBar from '$lib/components/TabBar.svelte';
  import Editor from '$lib/components/Editor.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import FindBar from '$lib/components/FindBar.svelte';
  import SettingsModal from '$lib/components/settings/SettingsModal.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import WindowResizeEdges from '$lib/components/WindowResizeEdges.svelte';
  import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
  import DebugPanel from '$lib/components/DebugPanel.svelte';
  import { editor } from '$lib/stores/editor';
  import { preferences } from '$lib/stores/preferences';
  import { setLanguage, t, type TranslationKey } from '$lib/i18n/index';
  import { openFileDialog, saveCurrentFile, closeTabWithConfirm, openFileFromPath, openDroppedMarkdownFiles, getCurrentTabId, getCurrentTab } from '$lib/services/fileOperations';
  import { showToast } from '$lib/stores/toast';
  import { setupKeyboardShortcuts } from '$lib/services/shortcuts';
  import { setupDebugShortcut } from '$lib/services/debug';
  import { startAutoSave } from '$lib/services/autoSave';
  import { initAppZoomWheel } from '$lib/services/appZoomWheel';
  import { initWindow } from '$lib/services/windowInit';
  import { setupWindowDrag } from '$lib/services/windowDrag';
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
  let isDragOver: boolean = $state(false);
  let findOpen: boolean = $state(false);

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

    // Window init: dynamic min size + maximized state tracking.
    // Try/catch parce que `getCurrentWindow()` Tauri throw en mode browser pur
    // (sans Tauri webview) ; sans try/catch, l'erreur bail out tout l'onMount
    // et casse les shortcuts/drop/etc. Pas bloquant en prod Tauri.
    try {
      const windowInit = await initWindow((maximized) => { isMaximized = maximized; });
      unsubs.push(windowInit.destroy);
    } catch (err) {
      console.warn('[+page] initWindow skipped (likely browser mode):', err);
    }

    // Global drag : any non-interactive area moves the window (Linux/WebKitGTK ne supporte pas -webkit-app-region)
    unsubs.push(setupWindowDrag());

    unsubs.push(preferences.subscribe((p) => {
      document.documentElement.setAttribute('data-theme', p.theme);
      document.documentElement.setAttribute('lang', p.language);
      setLanguage(p.language);
      // Apply editor preferences as CSS variables (font-size is no longer dynamic — it's a static :root value scaled by app zoom instead)
      document.documentElement.style.setProperty('--line-height', `${p.lineHeight}`);
      document.documentElement.style.setProperty('--font-family', p.fontFamily);
      // Sync background color to prevent white flash on resize (WebKitGTK issue)
      document.documentElement.style.setProperty('background-color', THEME_BG_MAP[p.theme] || DEFAULT_BG);
      document.body.style.setProperty('background-color', THEME_BG_MAP[p.theme] || DEFAULT_BG);

      // Hide scrollbar (body-level concern — CSS in global.css)
      document.body.classList.toggle('hide-scrollbar', p.hideScrollbar);
    }));

    // Auto-save : on ne déclenche un write disque que si l'onglet a un path
    // ET qu'il y a des modifs non sauvegardées. Sinon on signale 'unchanged'
    // pour que le timer ne réinitialise pas son backoff sur des ticks vides.
    const stopAutoSave = startAutoSave(
      () => get(preferences),
      async () => {
        const tab = getCurrentTab();
        if (!tab || !tab.path || !tab.isModified) return 'unchanged';
        const ok = await saveCurrentFile(tr);
        return ok ? 'saved' : 'failed';
      },
    );
    unsubs.push(stopAutoSave);

    // Confirmation avant fermeture si fichier non sauvegardé
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Check if a file was passed via CLI (double-click .md from file manager)
    try {
      const cliFile = await invokeWithTimeout<string | null>('get_cli_file', undefined, 5_000);
      if (cliFile) await openFileFromPath(cliFile, tr);
    } catch (err) {
      console.error('Failed to open CLI file:', err);
      showToast(tr('error_cli_file'), 'error');
    }

    // Tauri event listeners (open-file, drag-drop) : try/catch parce que les
    // API Tauri throw en mode browser pur. Comme initWindow ci-dessus, c'est
    // un no-op en browser et fonctionne en prod Tauri.
    try {
      const unlistenOpenFile = await listen<string>('open-file', (event) => openFileFromPath(event.payload, tr));
      unsubs.push(unlistenOpenFile);

      const unlistenDragDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
        const type = event.payload.type;
        if (type === 'enter' || type === 'over') {
          isDragOver = true;
        } else if (type === 'leave') {
          isDragOver = false;
        } else if (type === 'drop') {
          isDragOver = false;
          await openDroppedMarkdownFiles(event.payload.paths, tr);
        }
      });
      unsubs.push(unlistenDragDrop);
    } catch (err) {
      console.warn('[+page] Tauri event listeners skipped (likely browser mode):', err);
    }

    unsubs.push(t.subscribe((fn) => (tr = fn)));

    // App-level shortcuts (Ctrl+N, Ctrl+S, Ctrl+O, etc.)
    const removeShortcuts = setupKeyboardShortcuts({
      newFile: () => editor.addTab(),
      openFile: () => openFileDialog(tr),
      saveFile: () => saveCurrentFile(tr),
      closeTab: async () => { const id = getCurrentTabId(); if (id) await closeTabWithConfirm(id, tr); },
      toggleSidebar,
      openSettings: () => { settingsOpen = true; },
      isSettingsOpen: () => settingsOpen,
      openFind: () => { if (hasActiveTab) findOpen = true; },
    });
    unsubs.push(removeShortcuts);

    // Ctrl+Shift+D → toggle the debug panel
    unsubs.push(setupDebugShortcut());

    // Ctrl+wheel → app zoom (fine increments). Listener stays on window.
    unsubs.push(initAppZoomWheel());
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
        <FindBar open={findOpen} onclose={() => (findOpen = false)} />
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

<!-- Drop overlay : assombrit toute l'app pendant un drag-over de fichier.
     Tauri émet `enter`/`over`/`leave`/`drop` sur la webview entière (pas un
     event DOM standard), donc l'overlay est purement visuel — il n'intercepte
     pas le drop, ne fait que signaler à l'utilisateur où il peut lâcher. -->
{#if isDragOver}
  <div class="drop-overlay" role="presentation" aria-hidden="true">
    <div class="drop-overlay-inner">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="11" x2="12" y2="17"/>
        <polyline points="9 14 12 17 15 14"/>
      </svg>
      <div class="drop-overlay-text">{tr('drop_to_open')}</div>
    </div>
  </div>
{/if}

<!-- Toast notifications -->
<Toast />

<!-- Debug panel (toggled by Ctrl+Shift+D) -->
<DebugPanel />

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
    position: relative;
  }

  .drop-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    animation: drop-overlay-fade-in 120ms ease-out;
  }
  .drop-overlay-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px 48px;
    border: 2px dashed rgba(255, 255, 255, 0.5);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(0, 0, 0, 0.2);
  }
  .drop-overlay-text {
    font-size: 16px;
    font-weight: 500;
    font-family: var(--font-family);
  }
  @keyframes drop-overlay-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
