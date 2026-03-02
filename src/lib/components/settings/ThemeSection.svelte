<script lang="ts">
  import type { Preferences } from '$lib/stores/preferences';
  import type { TranslationKey } from '$lib/i18n/index';

  interface Props {
    prefs: Preferences;
    tr: (key: TranslationKey) => string;
    applyPrefs: () => void;
  }

  let { prefs = $bindable(), tr, applyPrefs }: Props = $props();

  const themes = [
    { id: 'light', bg: '#ffffff', accent: '#409EFF' },
    { id: 'dark', bg: '#282828', accent: '#409EFF' },
    { id: 'one-dark', bg: '#282c34', accent: '#4D78CC' },
    { id: 'graphite', bg: '#f7f7f7', accent: '#6886AA' },
    { id: 'material-dark', bg: '#34393f', accent: '#f48237' },
    { id: 'ulysses', bg: '#f3f3f3', accent: '#0C8BBA' },
  ];

  function setTheme(theme: string) {
    prefs.theme = theme;
    applyPrefs();
  }
</script>

<div class="setting-group">
  <h3>{tr('app_theme')}</h3>
  <div class="theme-grid">
    {#each themes as thm}
      <button class="theme-card" class:active={prefs.theme === thm.id} onclick={() => setTheme(thm.id)}>
        <div class="theme-preview" style="background: {thm.bg};">
          <div class="theme-accent" style="background: {thm.accent};"></div>
          <div class="theme-line" style="background: {thm.bg === '#ffffff' || thm.bg === '#f7f7f7' || thm.bg === '#f3f3f3' ? '#ddd' : '#555'};"></div>
          <div class="theme-line short" style="background: {thm.bg === '#ffffff' || thm.bg === '#f7f7f7' || thm.bg === '#f3f3f3' ? '#ddd' : '#555'};"></div>
        </div>
        <span class="theme-name">{thm.id}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .setting-group {
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .setting-group:last-child { border-bottom: none; }

  .setting-group h3 {
    font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 10px;
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .theme-card {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 8px; border: 2px solid var(--border); border-radius: 8px;
    background: transparent; color: var(--text-secondary);
    cursor: pointer; transition: all .15s ease; font-family: var(--font-family);
  }
  .theme-card:hover { border-color: var(--accent); }
  .theme-card.active { border-color: var(--accent); color: var(--text-primary); }

  .theme-preview {
    width: 100%; height: 48px; border-radius: 5px;
    border: 1px solid var(--border); position: relative;
    overflow: hidden; padding: 8px 10px;
  }

  .theme-accent {
    width: 30px; height: 4px; border-radius: 2px; margin-bottom: 6px;
  }

  .theme-line {
    height: 3px; border-radius: 1px; margin-bottom: 4px; width: 80%;
  }

  .theme-line.short { width: 50%; }

  .theme-name { font-size: 0.72rem; font-weight: 500; }
</style>
