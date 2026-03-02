<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { TranslationKey } from '$lib/i18n/index';

  let { tr, onNewFile, onOpenFile, onOpenFolder, onOpenSettings }: {
    tr: (key: TranslationKey) => string;
    onNewFile: () => void;
    onOpenFile: () => void;
    onOpenFolder: () => void;
    onOpenSettings: () => void;
  } = $props();
</script>

<div class="welcome" role="presentation" transition:fade={{ duration: 200 }} onmousedown={async (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('button') || target.closest('kbd') || target.closest('a')) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().startDragging();
}}>
  <!-- MarkText-style welcome with undraw illustration -->
  <img src="/icons/illustrations/undraw_content.svg" alt="" class="welcome-illustration" />
  <h1>MiraMD</h1>
  <p>{tr('subtitle')}</p>
  <div class="welcome-actions">
    <button onclick={onNewFile}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      {tr('new_file')}
    </button>
    <button onclick={onOpenFile}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
      {tr('open_file')}
    </button>
    <button onclick={onOpenFolder}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      {tr('open_folder')}
    </button>
  </div>
  <div class="welcome-actions" style="margin-top: 0.5rem;">
    <button onclick={onOpenSettings}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
      {tr('settings')}
    </button>
  </div>
  <div class="shortcuts">
    <span><kbd>Ctrl+N</kbd> {tr('new_file')}</span>
    <span><kbd>Ctrl+O</kbd> {tr('open_file')}</span>
    <span><kbd>Ctrl+S</kbd> {tr('save')}</span>
    <span><kbd>Ctrl+B</kbd> {tr('sidebar')}</span>
    <span><kbd>Ctrl+,</kbd> {tr('settings')}</span>
  </div>
</div>

<style>
  /* Welcome screen — MarkText "recent" style */
  .welcome {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: auto;
    gap: 0.75rem;
    color: var(--text-muted);
    text-align: center;
    padding: 2rem;
    background: var(--bg-primary);
  }

  .welcome-illustration {
    width: 200px;
    max-width: 60%;
    height: auto;
    opacity: 0.6;
    margin-bottom: 1rem;
  }

  .welcome h1 {
    font-size: 2rem;
    font-weight: 300;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .welcome p {
    font-size: 14px;
    margin-bottom: 0.75rem;
  }

  .welcome-actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .welcome-actions button {
    display: flex;
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

  .welcome-actions button:hover {
    transform: scale(1.05);
  }

  .shortcuts {
    margin-top: 1.5rem;
    display: flex;
    gap: 1.2rem;
    font-size: 12px;
    color: var(--text-muted);
    flex-wrap: wrap;
    justify-content: center;
  }

  .shortcuts kbd {
    background: var(--floatBgColor, var(--bg-secondary));
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 5px;
    font-family: var(--font-mono);
    font-size: 11px;
    box-shadow: inset 0 -1px 0 var(--floatBorderColor, var(--border));
  }
</style>
