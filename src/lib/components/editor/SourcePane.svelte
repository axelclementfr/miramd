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
  /** Contenu en attente d'être pushé vers Muya. On défère le push tant que le
   *  textarea est focus (sinon Muya re-render et vole le focus). Flush sur blur. */
  let pendingMuyaContent: string | null = null;
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

  function handleScroll() {
    if (!splitView) return;
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
    const result = syncPreviewTo(textareaEl.selectionStart, true);
    if (result) flashClickTarget(result.pane, result.target, referenceY);
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

    // Split mode : on diffère le push vers Muya tant que le textarea est focus.
    // Sinon muyaService.setMarkdown re-render le DOM du pane et vole le focus
    // (l'utilisateur ne peut plus taper). Flush sur blur ou sur pause >1.5s.
    if (splitView && muyaService.isReady()) {
      pendingMuyaContent = value;
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(tryFlushPendingMuyaContent, 1500);
    }
  }

  function tryFlushPendingMuyaContent() {
    if (pendingMuyaContent === null) return;
    if (!muyaService.isReady()) return;
    // Skip si encore focus — réessaye plus tard.
    if (document.activeElement === textareaEl) {
      syncTimer = setTimeout(tryFlushPendingMuyaContent, 1500);
      return;
    }
    try { muyaService.setMarkdown(pendingMuyaContent); } catch (e) { dlog('muya', 'SourcePane split sync:', e); }
    pendingMuyaContent = null;
  }

  function handleBlur() {
    // Blur = pas de risque de defocus puisque le textarea n'est déjà plus focus.
    // Flush immédiat de tout contenu en attente.
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
