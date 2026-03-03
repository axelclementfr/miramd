<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { editor } from '$lib/stores/editor';
  import type { DocumentStats } from '$lib/types/editor';
  import { preferences, type Preferences } from '$lib/stores/preferences';
  import { t, type TranslationKey } from '$lib/i18n/index';

  let stats: DocumentStats = $state({ words: 0, chars: 0, lines: 0, paragraphs: 0 });
  let prefs: Preferences = $state({} as Preferences);
  let tr: (key: TranslationKey) => string = $state((k: TranslationKey) => k);
  let activeTabReadOnly: boolean = $state(false);

  let unsubs: (() => void)[] = [];

  onMount(() => {
    unsubs.push(editor.stats.subscribe((s) => (stats = s)));
    unsubs.push(preferences.subscribe((p) => (prefs = { ...p })));
    unsubs.push(editor.activeTab.subscribe((tab) => (activeTabReadOnly = !!tab?.readOnly)));
    unsubs.push(t.subscribe((fn) => (tr = fn)));
  });

  onDestroy(() => unsubs.forEach((u) => u()));

  function toggleTheme() {
    const themes = ['dark', 'one-dark', 'material-dark', 'light', 'graphite', 'ulysses'];
    const idx = themes.indexOf(prefs.theme);
    const next = themes[(idx + 1) % themes.length];
    preferences.patch({ theme: next });
    document.documentElement.setAttribute('data-theme', next);
  }

  function toggleMode(mode: 'sourceCodeMode' | 'focusMode' | 'typewriterMode') {
    const patch: Partial<Preferences> = {};
    patch[mode] = !prefs[mode];
    if (mode === 'sourceCodeMode' && patch.sourceCodeMode) {
      patch.focusMode = false;
      patch.typewriterMode = false;
    }
    preferences.patch(patch);
  }

  function resetZoom() {
    preferences.patch({ zoom: 1.0 });
  }
</script>

<footer class="statusbar">
  <div class="statusbar-left">
    <span class="stat">{stats.words} {tr('words')}</span>
    <span class="sep">|</span>
    <span class="stat">{stats.chars} {tr('chars')}</span>
    <span class="sep">|</span>
    <span class="stat">{stats.lines} {tr('lines')}</span>
  </div>
  <div class="statusbar-right">
    <button
      class="mode-btn"
      class:active={activeTabReadOnly}
      onclick={() => editor.toggleActiveTabReadOnly()}
      title={tr('read_only_tooltip')}
    >
      {#if activeTabReadOnly}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      {:else}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
      {/if}
      <span>{activeTabReadOnly ? tr('read_only') : tr('edit_mode')}</span>
    </button>
    <button
      class="mode-btn"
      class:active={prefs.sourceCodeMode}
      onclick={() => toggleMode('sourceCodeMode')}
      title={tr('source_tooltip')}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
      <span>{tr('source')}</span>
    </button>
    <button
      class="mode-btn"
      class:active={prefs.focusMode}
      onclick={() => toggleMode('focusMode')}
      title={tr('focus_tooltip')}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
      <span>{tr('focus')}</span>
    </button>
    <button
      class="mode-btn"
      class:active={prefs.typewriterMode}
      onclick={() => toggleMode('typewriterMode')}
      title={tr('typewriter_tooltip')}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      <span>{tr('typewriter')}</span>
    </button>
    <button
      class="mode-btn"
      class:active={prefs.splitView}
      onclick={() => preferences.patch({ splitView: !prefs.splitView })}
      title={tr('split_desc')}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
      <span>Split</span>
    </button>
    <span class="sep">|</span>
    <button
      class="zoom-indicator"
      class:active={prefs.zoom !== 1.0}
      onclick={resetZoom}
      title={tr('zoom_reset_tooltip')}
    >
      {Math.round((prefs.zoom ?? 1) * 100)}%
    </button>
    <span class="sep">|</span>
    <button class="theme-toggle" onclick={toggleTheme} title={tr('change_theme')}>
      {prefs.theme === 'dark' || prefs.theme === 'one-dark' || prefs.theme === 'material-dark' ? '☀' : '☾'}
      <span class="theme-name">{prefs.theme}</span>
    </button>
  </div>
</footer>

<style>
  /* MarkText-style compact statusbar */
  .statusbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: var(--statusbar-height, 22px);
    min-height: var(--statusbar-height, 22px);
    max-height: var(--statusbar-height, 22px);
    padding: 0 10px;
    background: var(--bg-secondary);
    font-size: 12px;
    color: var(--text-muted);
    flex-shrink: 0;
    gap: 4px;
    border-top: 1px solid var(--border);
    position: relative;
    z-index: 50;
    overflow: hidden;
  }

  .statusbar-left, .statusbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stat { white-space: nowrap; }
  .sep { opacity: 0.3; }

  .mode-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    font-family: var(--font-family);
    padding: 1px 5px;
    transition: all .12s ease;
    white-space: nowrap;
  }

  .mode-btn:hover {
    background: var(--floatHoverColor, var(--bg-hover));
    color: var(--text-primary);
  }

  .mode-btn.active {
    background: rgba(124, 156, 238, 0.15);
    color: var(--accent);
    border-color: var(--accent);
  }

  .theme-toggle {
    display: flex;
    align-items: center;
    gap: 3px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 3px;
    font-family: var(--font-family);
  }

  .theme-toggle:hover {
    background: var(--floatHoverColor, var(--bg-hover));
    color: var(--text-primary);
  }

  .theme-name {
    font-size: 10px;
    opacity: 0.7;
  }

  .zoom-indicator {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    font-family: var(--font-mono, var(--font-family));
    padding: 1px 5px;
    border-radius: 3px;
    opacity: 0.6;
    transition: all .12s ease;
  }

  .zoom-indicator:hover {
    background: var(--floatHoverColor, var(--bg-hover));
    color: var(--text-primary);
    opacity: 1;
  }

  .zoom-indicator.active {
    opacity: 1;
    color: var(--accent);
  }
</style>
