<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { editor } from '$lib/stores/editor';
  import { t, type TranslationKey } from '$lib/i18n/index';

  let searchQuery: string = $state('');
  let caseSensitive: boolean = $state(false);
  let useRegex: boolean = $state(false);
  let wholeWord: boolean = $state(false);
  let searchResults: { line: number; text: string }[] = $state([]);
  let searchIndex: number = $state(0);
  let currentContent: string = $state('');
  let hasProjects: boolean = $state(false);

  let unsubs: (() => void)[] = [];
  let tr: (key: TranslationKey) => string = $state((k: TranslationKey) => k);

  interface Props { onopenFolder?: () => void; }
  let { onopenFolder }: Props = $props();

  onMount(() => {
    unsubs.push(t.subscribe((fn) => (tr = fn)));
    unsubs.push(editor.activeTab.subscribe((tab) => {
      if (tab) {
        currentContent = tab.content;
        if (searchQuery) runSearch();
      } else {
        currentContent = '';
        searchResults = [];
      }
    }));
  });

  onDestroy(() => unsubs.forEach((u) => u()));

  function runSearch() {
    if (!searchQuery || !currentContent) { searchResults = []; return; }
    let flags = 'g';
    if (!caseSensitive) flags += 'i';
    let pattern: RegExp;
    try {
      let src = useRegex ? searchQuery : searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (wholeWord) src = `\\b${src}\\b`;
      pattern = new RegExp(src, flags);
    } catch { searchResults = []; return; }

    const results: { line: number; text: string }[] = [];
    const lines = currentContent.split('\n');
    lines.forEach((line, i) => {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        results.push({ line: i + 1, text: line.trim().substring(0, 100) });
      }
    });
    searchResults = results;
    searchIndex = 0;
  }

  function onSearchInput() { runSearch(); }

  function navigateSearch(dir: 'next' | 'prev') {
    if (searchResults.length === 0) return;
    if (dir === 'next') searchIndex = (searchIndex + 1) % searchResults.length;
    else searchIndex = (searchIndex - 1 + searchResults.length) % searchResults.length;
    scrollToLine(searchResults[searchIndex].line);
  }

  function scrollToLine(lineNum: number) {
    const editorEl = document.querySelector('[contenteditable="true"]');
    if (!editorEl) return;
    const blocks = editorEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, table, hr');
    const target = blocks[Math.min(lineNum - 1, blocks.length - 1)];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('toc-highlight');
      setTimeout(() => target.classList.remove('toc-highlight'), 1200);
    }
  }

  function clickSearchResult(index: number) {
    searchIndex = index;
    scrollToLine(searchResults[index].line);
  }

  export function setHasProjects(v: boolean) { hasProjects = v; }
</script>

<div class="side-bar-search">
  <div class="search-wrapper">
    <input type="text" placeholder={tr('search_placeholder')} bind:value={searchQuery}
      oninput={onSearchInput}
      onkeydown={(e) => { if (e.key === 'Enter') navigateSearch('next'); if (e.key === 'Escape') { searchQuery = ''; searchResults = []; } }} />
    <div class="controls">
      <button class="is-case-sensitive" class:active={caseSensitive} title={tr('case_sensitive')}
        onclick={(e) => { e.stopPropagation(); caseSensitive = !caseSensitive; runSearch(); }}>
        <svg viewBox="0 0 20 20" width="20" height="20" stroke="none" fill-rule="evenodd">
          <path d="M10.919,13 L9.463,13 C9.29966585,13 9.16550052,12.9591671 9.0605,12.8775 C8.95549947,12.7958329 8.8796669,12.6943339 8.833,12.573 L8.077,10.508 L3.884,10.508 L3.128,12.573 C3.09066648,12.6803339 3.01716722,12.7783329 2.9075,12.867 C2.79783279,12.9556671 2.66366746,13 2.505,13 L1.042,13 L5.018,2.878 L6.943,2.878 L10.919,13 Z M4.367,9.178 L7.594,9.178 L6.362,5.811 C6.30599972,5.66166592 6.24416701,5.48550102 6.1765,5.2825 C6.108833,5.07949898 6.04233366,4.85900119 5.977,4.621 C5.91166634,4.85900119 5.84750032,5.08066564 5.7845,5.286 C5.72149969,5.49133436 5.65966697,5.67099923 5.599,5.825 L4.367,9.178 Z M18.892,13 L18.115,13 C17.9516658,13 17.8233338,12.9755002 17.73,12.9265 C17.6366662,12.8774998 17.5666669,12.7783341 17.52,12.629 L17.366,12.118 C17.1839991,12.2813341 17.0055009,12.4248327 16.8305,12.5485 C16.6554991,12.6721673 16.4746676,12.7759996 16.288,12.86 C16.1013324,12.9440004 15.903001,13.0069998 15.693,13.049 C15.4829989,13.0910002 15.2496679,13.112 14.993,13.112 C14.6896651,13.112 14.4096679,13.0711671 14.153,12.9895 C13.896332,12.9078329 13.6758342,12.7853342 13.4915,12.622 C13.3071657,12.4586658 13.1636672,12.2556679 13.061,12.013 C12.9583328,11.7703321 12.907,11.4880016 12.907,11.166 C12.907,10.895332 12.9781659,10.628168 13.1205,10.3645 C13.262834,10.100832 13.499665,9.8628344 13.831,9.6505 C14.162335,9.43816561 14.6033306,9.2620007 15.154,9.122 C15.7046694,8.9819993 16.3883292,8.90266676 17.205,8.884 L17.205,8.464 C17.205,7.98333093 17.103501,7.62750116 16.9005,7.3965 C16.697499,7.16549885 16.4023352,7.05 16.015,7.05 C15.7349986,7.05 15.5016676,7.08266634 15.315,7.148 C15.1283324,7.21333366 14.9661673,7.28683292 14.8285,7.3685 C14.6908326,7.45016707 14.5636672,7.52366634 14.447,7.589 C14.3303327,7.65433366 14.2020007,7.687 14.062,7.687 C13.9453327,7.687 13.8450004,7.65666697 13.761,7.596 C13.6769996,7.53533303 13.6093336,7.46066711 13.558,7.372 L13.243,6.819 C14.0690041,6.06299622 15.0653275,5.685 16.232,5.685 C16.6520021,5.685 17.0264983,5.75383264 17.3555,5.8915 C17.6845016,6.02916736 17.9633322,6.22049877 18.192,6.4655 C18.4206678,6.71050122 18.5944994,7.00333163 18.7135,7.344 C18.8325006,7.68466837 18.892,8.05799797 18.892,8.464 L18.892,13 Z M15.532,11.922 C15.7093342,11.922 15.8726659,11.9056668 16.022,11.873 C16.1713341,11.8403332 16.3124993,11.7913337 16.4455,11.726 C16.5785006,11.6606663 16.7068327,11.5801671 16.8305,11.4845 C16.9541673,11.3888329 17.0789993,11.2756673 17.205,11.145 L17.205,9.934 C16.7009975,9.95733345 16.279835,10.0004997 15.9415,10.0635 C15.603165,10.1265003 15.3313343,10.2069995 15.126,10.305 C14.9206656,10.4030005 14.7748337,10.5173327 14.6885,10.648 C14.6021662,10.7786673 14.559,10.9209992 14.559,11.075 C14.559,11.3783349 14.6488324,11.5953327 14.8285,11.726 C15.0081675,11.8566673 15.2426652,11.922 15.532,11.922 Z"/>
        </svg>
      </button>
      <button class="is-whole-word" class:active={wholeWord} title={tr('whole_word')}
        onclick={(e) => { e.stopPropagation(); wholeWord = !wholeWord; runSearch(); }}>
        <svg viewBox="0 0 20 20" width="20" height="20" stroke="none" fill-rule="evenodd">
          <rect opacity="0.6" x="1" y="3" width="2" height="6"></rect>
          <rect opacity="0.6" x="17" y="3" width="2" height="6"></rect>
          <rect x="6" y="3" width="2" height="6"></rect>
          <rect x="12" y="3" width="2" height="6"></rect>
          <rect x="9" y="3" width="2" height="6"></rect>
          <path d="M4.5,13 L15.5,13 L16,13 L16,12 L15.5,12 L4.5,12 L4,12 L4,13 L4.5,13 Z"></path>
          <path d="M4,10.5 L4,12.5 L4,13 L5,13 L5,12.5 L5,10.5 L5,10 L4,10 L4,10.5 Z"></path>
          <path d="M15,10.5 L15,12.5 L15,13 L16,13 L16,12.5 L16,10.5 L16,10 L15,10 L15,10.5 Z"></path>
        </svg>
      </button>
      <button class="is-regex" class:active={useRegex} title={tr('use_regex')}
        onclick={(e) => { e.stopPropagation(); useRegex = !useRegex; runSearch(); }}>
        <svg viewBox="0 0 20 20" width="20" height="20" stroke="none" fill-rule="evenodd">
          <rect x="3" y="10" width="3" height="3" rx="1"></rect>
          <rect x="12" y="3" width="2" height="9" rx="1"></rect>
          <rect x="12" y="3" width="2" height="9" rx="1" transform="translate(13, 7.5) rotate(60) translate(-13, -7.5)"></rect>
          <rect x="12" y="3" width="2" height="9" rx="1" transform="translate(13, 7.5) rotate(-60) translate(-13, -7.5)"></rect>
        </svg>
      </button>
    </div>
  </div>

  {#if searchResults.length === 0 && searchQuery.length > 0}
    <div class="search-message-section">{tr('no_results')}</div>
  {/if}
  {#if searchResults.length > 0}
    <div class="search-result-info">{searchResults.length} {searchResults.length > 1 ? tr('matches') : tr('match_single')} </div>
  {/if}

  {#if searchResults.length > 0}
    <div class="search-result-list">
      {#each searchResults as result, i (result.line)}
        <button class="search-result-item" class:active={i === searchIndex}
          onclick={() => clickSearchResult(i)} transition:fly={{ x: -30, duration: 150, delay: Math.min(i * 20, 200) }}>
          <span class="sr-line">L{result.line}</span>
          <span class="sr-text">{result.text}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="empty-search">
      <div class="no-data-inner">
        <img src="/icons/illustrations/undraw_empty.svg" alt="" class="empty-search-svg" />
        {#if !hasProjects}
          <button class="btn-open-folder" onclick={() => onopenFolder?.()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            {tr('open_folder')}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .side-bar-search {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-size: var(--font-size, 14px);
    font-family: var(--font-family);
    line-height: var(--line-height, 1.6);
  }

  .search-wrapper {
    display: flex;
    margin: 10px 13px;
    padding: 0 6px;
    border-radius: 14px;
    height: 28px;
    border: 1px solid var(--floatBorderColor, var(--border));
    background: var(--inputBgColor, var(--bg-primary));
    box-sizing: border-box;
    align-items: center;
  }

  .search-wrapper > input {
    color: var(--sideBarColor, var(--text-primary));
    background: transparent;
    height: 100%;
    flex: 1;
    border: none;
    outline: none;
    padding: 0 8px;
    font-size: inherit;
    font-family: var(--font-family);
    width: 50%;
  }

  .search-wrapper > .controls {
    display: flex;
    flex-shrink: 0;
    align-items: center;
  }

  .search-wrapper > .controls > button {
    cursor: default;
    width: 20px;
    height: 20px;
    margin-left: 2px;
    margin-right: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    font: inherit;
    padding: 0;
  }

  .search-wrapper > .controls > button > svg { fill: var(--iconColor, var(--text-muted)); }
  .search-wrapper > .controls > button:hover > svg { fill: var(--accent); }
  .search-wrapper > .controls > button.active > svg { fill: var(--accent); }

  .search-message-section {
    overflow-wrap: break-word;
    padding: 0 15px;
    margin-bottom: 5px;
    font-size: inherit;
    color: var(--sideBarColor, var(--text-secondary));
    text-align: center;
  }

  .search-result-info {
    padding-left: 15px;
    margin-bottom: 5px;
    font-size: 12px;
    color: var(--sideBarColor, var(--text-secondary));
  }

  .search-result-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .search-result-list::-webkit-scrollbar:vertical { width: 8px; }

  .search-result-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    padding: 4px 15px;
    color: var(--sideBarColor, var(--text-primary));
    cursor: default;
    font-size: inherit;
    transition: background .08s;
    background: none;
    border: none;
    font: inherit;
    text-align: left;
  }

  .search-result-item:hover { background: var(--sideBarItemHoverBgColor, var(--bg-hover)); }
  .search-result-item.active { background: var(--sideBarItemHoverBgColor, var(--bg-hover)); }

  .sr-line {
    color: var(--accent);
    font-size: 12px;
    font-family: var(--font-mono);
    flex-shrink: 0;
    min-width: 28px;
  }

  .sr-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-search {
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

  .no-data-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .empty-search-svg {
    fill: var(--accent);
    width: 120px;
    height: auto;
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
</style>
