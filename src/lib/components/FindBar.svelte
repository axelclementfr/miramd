<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { t, type TranslationKey } from '$lib/i18n/index';
  import { preferences } from '$lib/stores/preferences';
  import { collectMatchRanges, findMatchPositions, type MatchPosition } from '$lib/services/findInDocument';
  import { scrollTextareaToOffset } from '$lib/services/textareaCaret';

  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open, onclose }: Props = $props();

  let query: string = $state('');
  let activeIndex: number = $state(0);
  let matchCount: number = $state(0);
  let inputEl: HTMLInputElement | null = $state(null);
  let tr: (k: TranslationKey) => string = $state((k) => k);
  let sourceMode: boolean = $state(false);

  /** Ranges WYSIWYG (DOM-based) OU positions source (offsets dans textarea.value).
   * Exactement un des deux est non-vide à la fois selon le mode courant. */
  let currentRanges: Range[] = [];
  let currentPositions: MatchPosition[] = [];

  const unsubT = t.subscribe((fn) => (tr = fn));
  const unsubP = preferences.subscribe((p) => {
    const wasSource = sourceMode;
    sourceMode = !!p.sourceCodeMode;
    // Mode switch pendant que la barre est ouverte : re-search dans le nouveau contexte.
    if (open && wasSource !== sourceMode && query) runSearch();
  });
  onDestroy(() => {
    unsubT();
    unsubP();
    clearAll();
  });

  /** Focus + select uniquement à la TRANSITION d'ouverture (open false→true).
   * Si on dépendait simplement de `open`, l'effect re-runnait à chaque keystroke
   * (parce que le scope englobait `query`) et `el.select()` re-sélectionnait
   * tout le texte → la lettre suivante remplaçait tout, donnant l'impression
   * de "ne pouvoir taper qu'une lettre". On garde un flag `wasOpen` plain
   * (non réactif) pour ne déclencher que sur la transition. */
  let wasOpen = false;
  $effect(() => {
    const isOpenNow = open;
    if (isOpenNow && !wasOpen && inputEl) {
      const el = inputEl;
      setTimeout(() => { el.focus(); el.select(); }, 0);
      if (query) runSearch();
    } else if (!isOpenNow && wasOpen) {
      clearAll();
    }
    wasOpen = isOpenNow;
  });

  // ────────────────────────────────────────────────────────────────────────
  // WYSIWYG mode : DOM Ranges + CSS Custom Highlight API (pas de mutation DOM).
  // ────────────────────────────────────────────────────────────────────────

  function getWysiwygRoot(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.muya-editor');
  }

  /** Le conteneur scrollable de la preview WYSIWYG est `.wysiwyg-pane`. Le
   *  `<.muya-editor>` est à l'intérieur, sans scrollbar propre — c'est le
   *  parent qui scroll. Window/document scroll est ignoré par WebKit. */
  function getWysiwygScrollContainer(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.wysiwyg-pane');
  }

  function setWysiwygHighlights(ranges: Range[], activeIdx: number): void {
    const reg = typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null;
    if (!reg) return;
    if (ranges.length === 0) {
      reg.delete('find-match');
      reg.delete('find-match-active');
      return;
    }
    const hAll = new Highlight(...ranges);
    const hActive = new Highlight(ranges[activeIdx]);
    // Ordre des `set` = ordre de peinture (le 2e passe au-dessus → active visible).
    reg.set('find-match', hAll);
    reg.set('find-match-active', hActive);
  }

  function clearWysiwygHighlights(): void {
    const reg = typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null;
    if (reg) {
      reg.delete('find-match');
      reg.delete('find-match-active');
    }
  }

  function scrollWysiwygActive(): void {
    if (currentRanges.length === 0) return;
    const r = currentRanges[activeIndex];
    const container = getWysiwygScrollContainer();
    if (!r || !container) return;
    const rangeRect = r.getBoundingClientRect();
    if (rangeRect.width === 0) return;
    const containerRect = container.getBoundingClientRect();
    // Position du match relative au top du container, en coords container.
    const matchYInContainer = rangeRect.top - containerRect.top + container.scrollTop;
    // Centre vertical du container où on veut amener le match.
    const targetScrollTop = matchYInContainer - container.clientHeight / 2 + rangeRect.height / 2;
    const max = container.scrollHeight - container.clientHeight;
    const clamped = Math.max(0, Math.min(max, targetScrollTop));
    container.scrollTo({ top: clamped, behavior: 'smooth' });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Source mode : positions dans textarea.value + setSelectionRange.
  // CSS.highlights ne peut PAS décorer un textarea (pas de text node DOM).
  // On utilise la sélection native du browser pour signaler le match courant.
  // ────────────────────────────────────────────────────────────────────────

  function getSourceTextarea(): HTMLTextAreaElement | null {
    return document.querySelector<HTMLTextAreaElement>('.source-code-editor');
  }

  /** Affiche le match actif dans le textarea. `takeFocus=false` (frappe en
   *  cours dans le find-input) : on évite de voler le focus → la sélection
   *  reste visible (couleur "inactive" du browser, ~gris) sans interrompre
   *  l'utilisateur. `takeFocus=true` (clic flèche / Enter) : on focus la
   *  textarea pour avoir la sélection bleue native vive et donner la main. */
  function showSourceMatch(takeFocus: boolean): void {
    const ta = getSourceTextarea();
    if (!ta || currentPositions.length === 0) return;
    const m = currentPositions[activeIndex];
    if (!m) return;
    if (takeFocus) ta.focus({ preventScroll: true });
    ta.setSelectionRange(m.start, m.end);
    scrollTextareaToOffset(ta, m.start);
    refreshSourceOverlay();
  }

  /** Crée (ou met à jour) l'overlay derrière la textarea avec un highlight
   *  jaune sur CHAQUE match. CSS.highlights ne marche pas sur les textarea
   *  donc on simule via un div positionné absolu, color transparent, avec
   *  des <mark> au bg jaune. Scroll synchronisé via translateY. */
  let sourceScrollListener: (() => void) | null = null;
  let sourceResizeObserver: ResizeObserver | null = null;
  function refreshSourceOverlay(): void {
    const ta = getSourceTextarea();
    if (!ta) return;
    const pane = ta.parentElement;
    if (!pane) return;
    let overlay = pane.querySelector<HTMLDivElement>('.find-overlay-source');
    if (currentPositions.length === 0) {
      if (overlay) overlay.remove();
      detachSourceListeners(ta);
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'find-overlay-source';
      const content = document.createElement('div');
      content.className = 'find-overlay-source-content';
      overlay.appendChild(content);
      pane.insertBefore(overlay, ta);
      attachSourceListeners(ta, overlay);
    }
    const content = overlay.querySelector<HTMLDivElement>('.find-overlay-source-content');
    if (!content) return;

    // Aligne la largeur de l'overlay avec celle de l'aire de texte de la
    // textarea. `ta.clientWidth` exclut déjà la scrollbar verticale ; en
    // figeant overlay.width à cette valeur, les line-wraps tombent au même
    // endroit. Sans ça, la textarea wrap ~15px plus tôt à cause de sa
    // scrollbar interne, et les <mark> dérivent ligne après ligne.
    overlay.style.width = `${ta.clientWidth}px`;
    overlay.style.height = `${ta.clientHeight}px`;

    // Construit le HTML en alternant texte échappé et <mark> sur les matches.
    // L'index actif reçoit la classe .active pour le bg orange vif.
    const text = ta.value;
    let html = '';
    let lastIdx = 0;
    for (let i = 0; i < currentPositions.length; i++) {
      const m = currentPositions[i];
      html += escapeHtml(text.substring(lastIdx, m.start));
      const cls = i === activeIndex ? 'active' : '';
      html += `<mark class="${cls}">${escapeHtml(text.substring(m.start, m.end))}</mark>`;
      lastIdx = m.end;
    }
    html += escapeHtml(text.substring(lastIdx));
    content.innerHTML = html;
    content.style.transform = `translateY(${-ta.scrollTop}px)`;
  }

  function attachSourceListeners(ta: HTMLTextAreaElement, overlay: HTMLDivElement): void {
    detachSourceListeners(ta);
    sourceScrollListener = () => {
      const content = overlay.querySelector<HTMLElement>('.find-overlay-source-content');
      if (content) content.style.transform = `translateY(${-ta.scrollTop}px)`;
    };
    ta.addEventListener('scroll', sourceScrollListener, { passive: true });
    // Resize → l'overlay doit re-render parce que `clientWidth` change
    // (réduction de fenêtre = wrap différent = positions des matches qui
    // bougent visuellement). ResizeObserver capture tous les changements
    // de taille de la textarea (window resize, sidebar resize, etc.).
    sourceResizeObserver = new ResizeObserver(() => refreshSourceOverlay());
    sourceResizeObserver.observe(ta);
  }

  function detachSourceListeners(ta: HTMLTextAreaElement): void {
    if (sourceScrollListener) {
      ta.removeEventListener('scroll', sourceScrollListener);
      sourceScrollListener = null;
    }
    if (sourceResizeObserver) {
      sourceResizeObserver.disconnect();
      sourceResizeObserver = null;
    }
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clearSourceOverlay(): void {
    const ta = getSourceTextarea();
    if (ta) detachSourceListeners(ta);
    document.querySelectorAll('.find-overlay-source').forEach((el) => el.remove());
  }


  // ────────────────────────────────────────────────────────────────────────
  // Orchestration : runSearch / next / prev / clearAll routent selon le mode.
  // ────────────────────────────────────────────────────────────────────────

  function clearAll() {
    currentRanges = [];
    currentPositions = [];
    matchCount = 0;
    activeIndex = 0;
    clearWysiwygHighlights();
    clearSourceOverlay();
  }

  function runSearch() {
    if (!query) { clearAll(); return; }
    if (sourceMode) {
      const ta = getSourceTextarea();
      if (!ta) { clearAll(); return; }
      currentRanges = [];
      currentPositions = findMatchPositions(ta.value, query, false);
      matchCount = currentPositions.length;
      activeIndex = 0;
      clearWysiwygHighlights();
      // PAS de focus pendant la frappe : sinon le find-input perd le focus à
      // chaque lettre et la recherche devient impossible. L'overlay highlight
      // TOUS les matches via la classe .find-overlay-source (cf. CSS).
      if (matchCount > 0) {
        showSourceMatch(false);
      } else {
        clearSourceOverlay();
      }
    } else {
      const root = getWysiwygRoot();
      if (!root) { clearAll(); return; }
      currentPositions = [];
      currentRanges = collectMatchRanges(root, query, false);
      matchCount = currentRanges.length;
      activeIndex = 0;
      setWysiwygHighlights(currentRanges, activeIndex);
      scrollWysiwygActive();
    }
  }

  /** Sur navigation explicite (flèches / Enter), on prend le focus dans le
   *  textarea pour la sélection bleue vive, puis on rend la main au find-input
   *  pour que l'utilisateur puisse continuer à taper. */
  function applyActiveChange() {
    if (sourceMode) {
      showSourceMatch(true);
      setTimeout(() => { if (inputEl) inputEl.focus(); }, 0);
    } else {
      setWysiwygHighlights(currentRanges, activeIndex);
      scrollWysiwygActive();
    }
  }

  function next() {
    if (matchCount === 0) return;
    activeIndex = (activeIndex + 1) % matchCount;
    applyActiveChange();
  }

  function prev() {
    if (matchCount === 0) return;
    activeIndex = (activeIndex - 1 + matchCount) % matchCount;
    applyActiveChange();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onclose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prev(); else next();
    }
  }

  function onInput() { runSearch(); }
</script>

{#if open}
  <div class="find-bar" data-no-drag transition:fly={{ y: -10, duration: 120 }} role="search">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input
      bind:this={inputEl}
      type="text"
      class="find-input"
      placeholder={tr('find_placeholder')}
      bind:value={query}
      oninput={onInput}
      onkeydown={handleKeydown}
      aria-label={tr('find_placeholder')}
    />
    <span class="find-counter" class:no-match={query && matchCount === 0}>
      {#if query}
        {#if matchCount > 0}
          {activeIndex + 1} / {matchCount}
        {:else}
          {tr('find_no_matches')}
        {/if}
      {/if}
    </span>
    <button class="find-btn" onclick={prev} disabled={matchCount === 0} title="Shift+Enter" aria-label="Previous match">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <polygon points="2,8 6,3 10,8" fill="currentColor"/>
      </svg>
    </button>
    <button class="find-btn" onclick={next} disabled={matchCount === 0} title="Enter" aria-label="Next match">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <polygon points="2,4 6,9 10,4" fill="currentColor"/>
      </svg>
    </button>
    <button class="find-btn close" onclick={onclose} title="Escape" aria-label="Close find">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.5"/>
        <line x1="3" y1="9" x2="9" y2="3" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </button>
  </div>
{/if}

<style>
  .find-bar {
    position: absolute;
    top: 8px;
    right: 20px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: var(--floatBgColor, var(--bg-sidebar));
    color: var(--text-primary);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    font-family: var(--font-family);
    font-size: 13px;
  }
  .find-input {
    background: transparent;
    border: none;
    outline: none;
    color: inherit;
    font: inherit;
    min-width: 200px;
    padding: 2px 4px;
  }
  .find-counter {
    font-size: 11px;
    opacity: 0.6;
    min-width: 60px;
    text-align: center;
    white-space: nowrap;
  }
  .find-counter.no-match { color: var(--danger, #e06c75); opacity: 1; }
  .find-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .find-btn:hover:not(:disabled) { color: var(--text-primary); background: var(--bg-hover, rgba(255, 255, 255, 0.08)); }
  .find-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .find-btn:focus, .find-btn:focus-visible { outline: none; box-shadow: none; }
  .find-btn.close { margin-left: 4px; }

  /* Style des matches via CSS Custom Highlight API (pas de mutation DOM
     dans Muya, donc pas de crash du MutationObserver de l'éditeur live).
     `::highlight(name)` est styled globalement parce que la pseudo-element
     est rattachée au document, pas à un composant. */
  :global(::highlight(find-match)) {
    background-color: rgba(255, 213, 0, 0.4);
    color: inherit;
  }
  :global(::highlight(find-match-active)) {
    background-color: rgba(255, 165, 0, 0.9);
    color: black;
  }
</style>
