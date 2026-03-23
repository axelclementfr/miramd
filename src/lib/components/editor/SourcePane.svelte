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
  import {
    findTargetElement,
    highlightWordInPreview,
    clearAllSplitHighlights,
    unwrapSpan,
  } from '$lib/services/splitWordHighlight';

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
  /** Anchor capturé après un double-clic. Si présent, handleScroll passe en mode
   *  delta (preview scroll = anchor.dst + (current_src - anchor.src) * ratio) au
   *  lieu de recomputer via scrollTop+referenceY. Évite le rollback. Reset à null
   *  au tab switch (contenu différent = anchor obsolète). */
  let scrollAnchor: { srcScroll: number; dstScroll: number } | null = null;
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
      // Tab switch : contenu potentiellement très différent, anchor obsolète.
      scrollAnchor = null;
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

  let lastTarget: HTMLElement | null = null;
  let lastTargetTimer: ReturnType<typeof setTimeout> | null = null;

  function flashClickTarget(pane: HTMLElement, scrollTop: number, alignOffsetY: number) {
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

  /** Wrapper local : nettoie les timers du composant + appelle le service. */
  function clearAllHighlightsLocal() {
    if (highlightTimer) { clearTimeout(highlightTimer); highlightTimer = null; }
    if (lastTargetTimer) { clearTimeout(lastTargetTimer); lastTargetTimer = null; }
    lastTarget = null;
    clearAllSplitHighlights(document.querySelector('.wysiwyg-pane') as HTMLElement | null);
  }

  let highlightTimer: ReturnType<typeof setTimeout> | null = null;

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
      const previewPane = document.querySelector('.wysiwyg-pane') as HTMLElement | null;
      if (!previewPane) return;

      const srcMax = textareaEl.scrollHeight - textareaEl.clientHeight;
      const dstMax = previewPane.scrollHeight - previewPane.clientHeight;

      if (scrollAnchor && srcMax > 0 && dstMax > 0) {
        // Mode delta post-double-clic : preview suit la source proportionnellement
        // depuis l'anchor. Pas de recompute → pas de rollback.
        const deltaSrc = textareaEl.scrollTop - scrollAnchor.srcScroll;
        const ratio = dstMax / srcMax;
        const newDst = scrollAnchor.dstScroll + deltaSrc * ratio;
        previewPane.scrollTop = Math.max(0, Math.min(dstMax, newDst));
      } else {
        // Mode anchored par défaut (avant tout double-clic).
        const refContentY = textareaEl.scrollTop + referenceY;
        const srcCharPos = textareaEl.scrollHeight > 0
          ? Math.round((refContentY / textareaEl.scrollHeight) * textareaEl.value.length)
          : 0;
        syncPreviewTo(srcCharPos, false);
      }
    });
  }

  function handleDoubleClick(event: MouseEvent) {
    if (!splitView) return;
    if (!textareaEl) return;

    // Cleanup d'abord : évite d'avoir 2 highlights superposés (l'ancien pas
    // encore expiré et le nouveau).
    clearAllHighlightsLocal();

    // Mémorise la Y du clic dans le viewport du textarea.
    const rect = textareaEl.getBoundingClientRect();
    referenceY = Math.max(0, Math.min(textareaEl.clientHeight, event.clientY - rect.top));

    // Suppress scroll sync pendant 500ms (smooth scroll en cours).
    suppressScrollSyncUntil = Date.now() + 500;

    const result = syncPreviewTo(textareaEl.selectionStart, true);
    if (!result) return;

    // Capture l'anchor : scrolls ultérieurs en mode delta depuis cette position.
    scrollAnchor = {
      srcScroll: textareaEl.scrollTop,
      dstScroll: result.target,
    };

    // Highlight le mot exact ; fallback outline du bloc si non trouvable.
    const span = highlightWordInPreview(
      result.pane,
      textareaEl.value,
      textareaEl.selectionStart,
      textareaEl.selectionEnd,
    );
    if (span) {
      highlightTimer = setTimeout(() => unwrapSpan(span), 1800);
    } else {
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
