<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { fade } from 'svelte/transition';
  import { editor } from '$lib/stores/editor';
  import type { TocEntry } from '$lib/types/editor';
  import { extractHeadings } from '$lib/services/toc';
  import { dlog } from '$lib/services/debug';
  import { t, type TranslationKey } from '$lib/i18n/index';

  interface TocNode { level: number; text: string; pos: number; children: TocNode[]; collapsed: boolean; }
  let tocTree: TocNode[] = $state([]);

  let unsubs: (() => void)[] = [];
  let tr: (key: TranslationKey) => string = $state((k: TranslationKey) => k);

  onMount(() => {
    unsubs.push(t.subscribe((fn) => (tr = fn)));
    unsubs.push(editor.activeTab.subscribe((tab) => {
      if (tab) {
        tocTree = buildTree(extractHeadings(tab.content));
      } else {
        tocTree = [];
      }
    }));
  });

  onDestroy(() => unsubs.forEach((u) => u()));

  function buildTree(flat: TocEntry[]): TocNode[] {
    const root: TocNode[] = [];
    const stack: TocNode[] = [];
    for (const entry of flat) {
      const node: TocNode = { ...entry, children: [], collapsed: false };
      while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) stack.pop();
      if (stack.length === 0) root.push(node);
      else stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
    return root;
  }

  function toggleCollapse(node: TocNode) {
    node.collapsed = !node.collapsed;
    tocTree = [...tocTree];
  }

  /**
   * Scroll the Muya editor to the heading at `targetPos` (markdown source byte offset).
   *
   * Strategy: find the Nth heading in the source (by pos), then pick the Nth rendered
   * H element in the Muya DOM. This handles duplicates correctly (text-match would
   * always navigate to the first occurrence).
   *
   * The selector `.muya-editor` is used instead of `[contenteditable="true"]` because
   * the latter fails in three cases the previous version mishandled silently:
   *  - Lock mode (per-tab readOnly): contenteditable is forced to false
   *  - Split mode with sourceCodeMode: contenteditable is forced to false
   *  - Pure source mode: muya-editor is hidden but query still matches → no-op scroll
   */
  function scrollToHeading(targetPos: number) {
    const tab = get(editor.activeTab);
    if (!tab) {
      dlog('toc', 'scrollToHeading: no active tab');
      return;
    }
    const flat = extractHeadings(tab.content);
    const index = flat.findIndex((h) => h.pos === targetPos);
    if (index < 0) {
      dlog('toc', 'scrollToHeading: pos not found in extracted headings, pos:', targetPos);
      return;
    }

    const container = document.querySelector('.muya-editor');
    if (!container) {
      dlog('toc', 'scrollToHeading: .muya-editor not found in DOM');
      return;
    }

    // Detect hidden Muya (pure source mode). scrollIntoView on hidden = no-op,
    // and the user gets no feedback. Log it so debug-mode users see why.
    const wysiwygPane = container.closest('.wysiwyg-pane');
    if (wysiwygPane?.classList.contains('hidden')) {
      dlog('toc', 'scrollToHeading: .wysiwyg-pane is hidden (source mode), skipping. Switch to normal/split view to navigate via TOC.');
      return;
    }

    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const target = headings[index];
    if (!target) {
      dlog('toc', 'scrollToHeading: heading index', index, 'not found in DOM (rendered count:', headings.length, ')');
      return;
    }

    dlog('toc', 'scrollToHeading: navigating to index', index, 'pos', targetPos);
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('toc-highlight');
    setTimeout(() => target.classList.remove('toc-highlight'), 1500);
  }
</script>

<div class="side-bar-toc">
  <div class="toc-main-title">{tr('toc')}</div>

  {#if tocTree.length > 0}
    <div class="toc-tree">
      {#each tocTree as node}
        {@render tocNode(node, 0)}
      {/each}
    </div>
  {:else}
    <div class="no-data" transition:fade={{ duration: 200 }}>
      <img src="/icons/illustrations/undraw_toc_empty.svg" alt="" class="empty-illustration" />
    </div>
  {/if}
</div>

{#snippet tocNode(node: TocNode, depth: number)}
  <div class="toc-node" style="padding-left: {8 + depth * 14}px;" onclick={() => scrollToHeading(node.pos)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToHeading(node.pos); } }} role="button" tabindex="0">
    {#if node.children.length > 0}
      <button class="toc-arrow-btn" aria-label="Toggle" onclick={(e) => { e.stopPropagation(); toggleCollapse(node); }}>
        <svg class="icon-arrow" class:collapsed={node.collapsed} width="14" height="14" viewBox="0 0 6 8">
          <polygon points="0,0 6,4 0,8" fill="currentColor"/>
        </svg>
      </button>
    {:else}
      <span style="width: 6px; flex-shrink: 0;"></span>
    {/if}
    <span class="toc-node-text">{node.text}</span>
  </div>
  {#if node.children.length > 0 && !node.collapsed}
    {#each node.children as child}
      {@render tocNode(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<style>
  .side-bar-toc {
    height: calc(100% - 35px);
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    font-size: var(--font-size, 14px);
    font-family: var(--font-family);
    line-height: var(--line-height, 1.6);
  }

  .toc-main-title {
    color: var(--sideBarTitleColor, var(--text-primary));
    font-weight: 600;
    font-size: inherit;
    padding: 8px 13px 8px 23px;
    flex-shrink: 0;
  }

  .toc-tree {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }

  .toc-arrow-btn {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: default;
    color: inherit;
    display: flex;
    align-items: center;
  }

  .toc-node {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 26px;
    cursor: default;
    padding: 2px 8px;
    margin-top: 8px;
    border-radius: 3px;
    color: var(--sideBarColor, var(--text-primary));
    font-size: inherit;
    font: inherit;
    transition: background .08s;
    background: none;
    border: none;
    width: 100%;
    text-align: left;
  }
  .toc-node:hover { background: var(--sideBarItemHoverBgColor, var(--bg-hover)); }

  .toc-node-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-arrow {
    flex-shrink: 0;
    margin-right: 5px;
    fill: var(--sideBarTextColor, var(--text-muted));
    transform: rotate(90deg);
    transition: all .25s ease-out;
    cursor: default;
  }
  .icon-arrow.collapsed { transform: rotate(0deg); }

  .no-data {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-bottom: 80px;
  }

  .empty-illustration {
    width: 120px;
    height: auto;
    opacity: 0.5;
  }
</style>
