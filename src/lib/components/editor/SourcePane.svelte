<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { editor as editorStore } from '$lib/stores/editor';
  import { preferences } from '$lib/stores/preferences';
  import { muyaService } from '$lib/services/muya';
  import { editorModes } from '$lib/services/editorModes';
  import { updateStats } from '$lib/services/stats';
  import { dlog } from '$lib/services/debug';
  import { computeAnchoredScroll, type ScrollAnchor } from '$lib/services/splitScrollSync';
  import { extractHeadings } from '$lib/services/toc';

  let readOnly: boolean = $state(false);
  let splitView: boolean = $state(false);
  let textareaEl: HTMLTextAreaElement = $state(null as any);
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  let storeTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollSyncRaf = 0;
  /** Y dans le viewport du textarea où on aligne le contenu cible dans la preview.
   *  0 = haut. Mis à jour quand l'utilisateur double-clique (= clientY du clic).
   *  Persistant : le scroll réutilise la dernière valeur, donc la sélection ne saute pas. */
  let referenceY = 0;
  /** Contenu en attente d'être pushé vers Muya. Flush sur pause OU blur. */
  let pendingMuyaContent: string | null = null;
  /** Suppress handleScroll jusqu'à ce timestamp — évite que le smooth scroll
   *  post-double-clic soit interrompu par les events scroll qu'il déclenche. */
  let suppressScrollSyncUntil = 0;
  let unsubs: (() => void)[] = [];

  onMount(() => {
    // Load content into textarea directly (uncontrolled)
    unsubs.push(editorModes.sourceContent.subscribe((c) => {
      // Only set value if textarea is not focused (user not typing)
      if (textareaEl && document.activeElement !== textareaEl) {
        textareaEl.value = c;
      }
    }));

    unsubs.push(preferences.subscribe((p) => {
      splitView = p.splitView;
    }));

    unsubs.push(editorStore.activeTab.subscribe((tab) => {
      readOnly = !!tab?.readOnly;
    }));
  });

  onDestroy(() => {
    unsubs.forEach((u) => u());
    if (syncTimer) clearTimeout(syncTimer);
    if (storeTimer) clearTimeout(storeTimer);
    if (scrollSyncRaf) cancelAnimationFrame(scrollSyncRaf);
  });

  /** Returns the computed target scrollTop, or null if sync couldn't run. */
  function syncPreviewTo(srcCharPos: number, smooth: boolean): { pane: HTMLElement; target: number } | null {
    const previewPane = document.querySelector('.wysiwyg-pane') as HTMLElement | null;
    if (!previewPane || !textareaEl) return null;

    const source = textareaEl.value;
    const dstMax = previewPane.scrollHeight - previewPane.clientHeight;

    const headings = extractHeadings(source);
    const previewHeadings = previewPane.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const n = Math.min(headings.length, previewHeadings.length);
    const anchors: ScrollAnchor[] = [];
    for (let i = 0; i < n; i++) {
      anchors.push({
        srcPos: headings[i].pos,
        dstTop: (previewHeadings[i] as HTMLElement).offsetTop,
      });
    }

    const target = computeAnchoredScroll(
      srcCharPos,
      source.length,
      anchors,
      dstMax,
      previewPane.scrollHeight,
      referenceY,
    );

    if (smooth) {
      previewPane.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      previewPane.scrollTop = target;
    }

    return { pane: previewPane, target };
  }

  /** Find the block-level rendered element closest to the target Y in pane content coords.
   *  targetContentY = scrollTop + alignOffsetY (= où le curseur se trouve dans la preview viewport). */
  function findTargetElement(pane: HTMLElement, scrollTop: number, alignOffsetY: number): HTMLElement | null {
    const targetContentY = scrollTop + alignOffsetY;
    const candidates = pane.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, table, hr');
    let best: HTMLElement | null = null;
    let bestDistance = Infinity;
    candidates.forEach((node) => {
      const el = node as HTMLElement;
      const distance = Math.abs(el.offsetTop - targetContentY);
      if (distance < bestDistance) {
        best = el;
        bestDistance = distance;
      }
    });
    return best;
  }

  let lastTarget: HTMLElement | null = null;
  let lastTargetTimer: ReturnType<typeof setTimeout> | null = null;

  function flashClickTarget(pane: HTMLElement, scrollTop: number, alignOffsetY: number) {
    // Clean previous highlight if any (rapid double-clicks)
    if (lastTarget) lastTarget.classList.remove('split-click-target');
    if (lastTargetTimer) clearTimeout(lastTargetTimer);

    const target = findTargetElement(pane, scrollTop, alignOffsetY);
    if (!target) return;
    target.classList.add('split-click-target');
    lastTarget = target;
    lastTargetTimer = setTimeout(() => {
      target.classList.remove('split-click-target');
      if (lastTarget === target) lastTarget = null;
    }, 1600);
  }

  /** Walk text nodes inside `root` and return a Range surrounding the
   *  `occurrenceIndex`-th occurrence of `word`. */
  function findTextOccurrence(root: Node, word: string, occurrenceIndex: number): Range | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent || '';
      let pos = 0;
      while ((pos = text.indexOf(word, pos)) !== -1) {
        if (count === occurrenceIndex) {
          const range = document.createRange();
          range.setStart(node, pos);
          range.setEnd(node, pos + word.length);
          return range;
        }
        count++;
        pos += word.length;
      }
    }
    return null;
  }

  let highlightTimer: ReturnType<typeof setTimeout> | null = null;
  const HIGHLIGHT_API: any =
    typeof CSS !== 'undefined' && (CSS as any).highlights ? (CSS as any).highlights : null;

  /** Highlight the same word the user double-clicked in source, in the preview.
   *  Returns true if highlight succeeded (used to skip the block-outline fallback). */
  function highlightWordInPreview(pane: HTMLElement, source: string, selStart: number, selEnd: number): boolean {
    const word = source.substring(selStart, selEnd);
    if (!word.trim() || word.length < 1) return false;

    // Count occurrences of `word` in source up to selStart → which occurrence
    // index does this match in the preview's rendered text content?
    let occurrenceIndex = 0;
    let pos = 0;
    while ((pos = source.indexOf(word, pos)) !== -1 && pos < selStart) {
      occurrenceIndex++;
      pos += word.length;
    }

    const range = findTextOccurrence(pane, word, occurrenceIndex);
    if (!range) return false;

    if (highlightTimer) clearTimeout(highlightTimer);

    if (HIGHLIGHT_API) {
      try {
        HIGHLIGHT_API.delete('split-word-target');
        // @ts-ignore — Highlight constructor available in modern browsers
        const highlight = new Highlight(range);
        HIGHLIGHT_API.set('split-word-target', highlight);
        highlightTimer = setTimeout(() => HIGHLIGHT_API.delete('split-word-target'), 1800);
        return true;
      } catch (e) { dlog('muya', 'CSS Highlight API failed:', e); }
    }

    // Fallback : Selection API (visualisation native du browser)
    try {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
        highlightTimer = setTimeout(() => {
          const s = window.getSelection();
          // Only clear if the selection still belongs to our range
          if (s && s.rangeCount > 0) s.removeAllRanges();
        }, 1800);
        return true;
      }
    } catch (e) { dlog('muya', 'Selection API fallback failed:', e); }

    return false;
  }

  /** Sync setMarkdown vers Muya tout en préservant agressivement le focus du
   *  textarea. Solution : focusin guardian + plusieurs tentatives de refocus
   *  (sync + microtask + raf + raf+raf + final 200ms). */
  function applySetMarkdownPreservingFocus(value: string) {
    if (!muyaService.isReady()) return;
    const wasFocused = document.activeElement === textareaEl;
    if (!wasFocused) {
      try { muyaService.setMarkdown(value); } catch (e) { dlog('muya', 'setMarkdown:', e); }
      return;
    }

    const selStart = textareaEl.selectionStart;
    const selEnd = textareaEl.selectionEnd;
    const scrollTop = textareaEl.scrollTop;
    const previewPane = document.querySelector('.wysiwyg-pane') as HTMLElement | null;

    const refocus = () => {
      if (document.activeElement === textareaEl) return;
      const cur = document.activeElement;
      if (cur instanceof HTMLElement && cur !== document.body) cur.blur();
      textareaEl.focus({ preventScroll: true });
      try { textareaEl.setSelectionRange(selStart, selEnd); } catch {}
      textareaEl.scrollTop = scrollTop;
    };

    // Guard : tout focusin sur un descendant de previewPane → refocus textarea
    const guardian = (e: FocusEvent) => {
      const target = e.target as Node | null;
      if (previewPane && target && previewPane.contains(target)) refocus();
    };
    document.addEventListener('focusin', guardian, true);

    try { muyaService.setMarkdown(value); } catch (e) { dlog('muya', 'setMarkdown:', e); }

    refocus();
    Promise.resolve().then(refocus);
    requestAnimationFrame(() => {
      refocus();
      requestAnimationFrame(refocus);
    });

    setTimeout(() => {
      document.removeEventListener('focusin', guardian, true);
      refocus();
    }, 200);
  }

  function handleScroll() {
    if (!splitView) return;
    if (Date.now() < suppressScrollSyncUntil) return;
    if (scrollSyncRaf) return; // already scheduled this frame
    scrollSyncRaf = requestAnimationFrame(() => {
      scrollSyncRaf = 0;
      if (!textareaEl) return;
      // Aligne le caractère qui est à Y=referenceY dans le viewport source
      // (et non plus le caractère du tout-haut), pour rester cohérent avec la
      // dernière position de référence posée par un double-clic.
      const refContentY = textareaEl.scrollTop + referenceY;
      const srcCharPos = textareaEl.scrollHeight > 0
        ? Math.round((refContentY / textareaEl.scrollHeight) * textareaEl.value.length)
        : 0;
      syncPreviewTo(srcCharPos, false);
    });
  }

  function handleDoubleClick(event: MouseEvent) {
    if (!splitView) return;
    if (!textareaEl) return;
    // Mémorise la Y du clic dans le viewport du textarea : la preview place
    // l'élément cible à la même hauteur visuelle, et les scrolls ultérieurs
    // gardent cette référence.
    const rect = textareaEl.getBoundingClientRect();
    referenceY = Math.max(0, Math.min(textareaEl.clientHeight, event.clientY - rect.top));

    // Suppress scroll sync pendant 500ms : le smooth scroll qui suit déclenche
    // des events scroll sur la textarea (auto-scroll vers caret), qui sinon
    // re-synthétiseraient un target différent et provoqueraient un rollback.
    suppressScrollSyncUntil = Date.now() + 500;

    const result = syncPreviewTo(textareaEl.selectionStart, true);
    if (!result) return;

    // Highlight le mot exact double-cliqué dans la preview ; si introuvable
    // (cross-boundary, syntax mismatch), fallback sur l'outline du bloc.
    const wordHighlighted = highlightWordInPreview(
      result.pane,
      textareaEl.value,
      textareaEl.selectionStart,
      textareaEl.selectionEnd,
    );
    if (!wordHighlighted) {
      flashClickTarget(result.pane, result.target, referenceY);
    }
  }

  function handleInput() {
    const value = textareaEl.value;

    // Debounce store update — textarea is instant, store can wait
    if (storeTimer) clearTimeout(storeTimer);
    storeTimer = setTimeout(() => {
      editorModes.sourceContent.set(value);
      const tabId = get(editorStore.activeTabId);
      if (tabId) editorStore.updateContent(tabId, value);
      updateStats(value, true);
    }, 150);

    // Split mode : sync live vers Muya avec préservation agressive du focus
    // (focusin guardian + multiples refocus). Debounce 400ms pour live feel.
    if (splitView && muyaService.isReady()) {
      pendingMuyaContent = value;
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        if (pendingMuyaContent === null) return;
        applySetMarkdownPreservingFocus(pendingMuyaContent);
        pendingMuyaContent = null;
      }, 400);
    }
  }

  function handleBlur() {
    // Blur : flush immédiat (pas de risque de defocus puisque déjà non-focus).
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }
    if (pendingMuyaContent !== null && splitView && muyaService.isReady()) {
      try { muyaService.setMarkdown(pendingMuyaContent); } catch (e) { dlog('muya', 'SourcePane split sync on blur:', e); }
      pendingMuyaContent = null;
    }
  }
</script>

<div class="source-pane">
  <textarea
    bind:this={textareaEl}
    class="source-code-editor"
    oninput={handleInput}
    onscroll={handleScroll}
    ondblclick={handleDoubleClick}
    onblur={handleBlur}
    spellcheck="true"
    readonly={readOnly}
  ></textarea>
</div>

<style>
  .source-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }
</style>
