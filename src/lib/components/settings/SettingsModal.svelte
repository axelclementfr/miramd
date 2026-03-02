<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { preferences, type Preferences } from '$lib/stores/preferences';
  import { t, type TranslationKey } from '$lib/i18n/index';
  import ThemeSection from './ThemeSection.svelte';
  import GeneralSection from './GeneralSection.svelte';
  import EditorSection from './EditorSection.svelte';
  import ViewSection from './ViewSection.svelte';
  import MarkdownSection from './MarkdownSection.svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  let prefs: Preferences = $state({} as Preferences);
  let activeSection: TranslationKey = $state('theme' as TranslationKey);
  let tr: (key: TranslationKey) => string = $state((k: TranslationKey) => k);

  let unsubs: (() => void)[] = [];
  onMount(() => {
    unsubs.push(preferences.subscribe((p) => (prefs = { ...p })));
    unsubs.push(t.subscribe((fn) => (tr = fn)));
  });
  onDestroy(() => unsubs.forEach((u) => u()));

  const sectionIds: TranslationKey[] = ['theme', 'general', 'editor', 'view', 'markdown'];

  // Apply prefs immediately on any change
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function applyPrefs() {
    if (!open) return;
    document.documentElement.setAttribute('data-theme', prefs.theme);
    document.documentElement.setAttribute('lang', prefs.language);
    document.documentElement.style.setProperty('--font-size', `${Math.round((prefs.fontSize || 16) * (prefs.zoom || 1.0))}px`);
    document.documentElement.style.setProperty('--line-height', `${prefs.lineHeight}`);
    document.documentElement.style.setProperty('--font-family', prefs.fontFamily);
    // Debounced save to Rust backend
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => preferences.save(prefs), 200);
  }

  function close() {
    preferences.save(prefs);
    onclose();
  }

  function handleBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) close();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdrop} onkeydown={(e) => e.key === 'Escape' && close()} role="dialog" tabindex="-1">
    <div class="modal" transition:fly|global={{ y: 12, duration: 200 }}>
      <!-- Sidebar navigation -->
      <div class="modal-nav">
        <div class="modal-nav-title">{tr('settings')}</div>
        {#each sectionIds as id}
          <button
            class="nav-item"
            class:active={activeSection === id}
            onclick={() => (activeSection = id)}
          >
            <span>{tr(id)}</span>
          </button>
        {/each}
        <div class="nav-footer">
          <span>MiraMD v0.1.0</span>
        </div>
      </div>

      <!-- Content -->
      <div class="modal-main">
        <div class="modal-header">
          <h2>{tr(activeSection)}</h2>
          <button class="modal-close" onclick={close}>&times;</button>
        </div>

        <div class="modal-body">
          {#if activeSection === 'theme'}
            <ThemeSection bind:prefs {tr} {applyPrefs} />
          {:else if activeSection === 'general'}
            <GeneralSection bind:prefs {tr} {applyPrefs} />
          {:else if activeSection === 'editor'}
            <EditorSection bind:prefs {tr} {applyPrefs} />
          {:else if activeSection === 'view'}
            <ViewSection bind:prefs {tr} {applyPrefs} />
          {:else if activeSection === 'markdown'}
            <MarkdownSection bind:prefs {tr} {applyPrefs} />
          {/if}
        </div>

        <!-- No footer: settings auto-save -->
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20000;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: backdropIn 0.15s ease;
  }

  @keyframes backdropIn {
    from { background: rgba(0, 0, 0, 0); }
    to { background: rgba(0, 0, 0, 0.45); }
  }

  .modal {
    width: min(680px, 95vw);
    height: min(500px, 85vh);
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    display: flex;
    overflow: hidden;
  }

  /* Nav sidebar */
  .modal-nav {
    width: 180px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 16px 0;
    flex-shrink: 0;
  }

  .modal-nav-title {
    padding: 0 16px 12px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.82rem;
    text-align: left;
    transition: all .1s ease;
    font-family: var(--font-family);
  }

  .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .nav-item.active { background: var(--bg-hover); color: var(--accent); font-weight: 500; }
  .nav-footer {
    margin-top: auto;
    padding: 12px 16px 0;
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  /* Main content */
  .modal-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--border);
  }

  .modal-header h2 { font-size: 1rem; font-weight: 600; margin: 0; }

  .modal-close {
    background: none; border: none; color: var(--text-muted);
    font-size: 1.3rem; cursor: pointer; padding: 2px 6px;
    border-radius: 4px; line-height: 1;
  }
  .modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px;
  }

  .modal-body::-webkit-scrollbar { width: 5px; }
  .modal-body::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }

  /* Animations handled by Svelte transitions */
</style>
