<script lang="ts">
  let { isMaximized }: { isMaximized: boolean } = $props();

  /** Si le clic sur la zone resize-edge se trouve aussi au-dessus d'une scrollbar
   *  d'un élément en-dessous, on skip le resize pour laisser passer le clic à
   *  la scrollbar. Sans ça, les scrollbars proches du bord droit/bas de la
   *  fenêtre étaient inutilisables (resize gagnait à cause du z-index 99999).
   *
   *  Technique : on cache temporairement la resize-edge (pointer-events: none),
   *  on query l'élément réellement sous le curseur, on regarde si on tombe
   *  dans sa zone scrollbar (offsetX/Y > clientWidth/Height). */
  function clickOverlapsScrollbar(e: MouseEvent, side: 'right' | 'bottom'): boolean {
    const target = e.currentTarget as HTMLElement | null;
    if (!target) return false;
    const originalPE = target.style.pointerEvents;
    target.style.pointerEvents = 'none';
    const below = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    target.style.pointerEvents = originalPE;
    if (!(below instanceof HTMLElement)) return false;
    const rect = below.getBoundingClientRect();
    const cs = getComputedStyle(below);
    const borderL = parseFloat(cs.borderLeftWidth) || 0;
    const borderT = parseFloat(cs.borderTopWidth) || 0;
    const offsetX = e.clientX - rect.left - borderL;
    const offsetY = e.clientY - rect.top - borderT;
    if (side === 'right' && offsetX > below.clientWidth && below.scrollHeight > below.clientHeight) return true;
    if (side === 'bottom' && offsetY > below.clientHeight && below.scrollWidth > below.clientWidth) return true;
    return false;
  }

  async function startResize(e: MouseEvent, direction: string) {
    // Resize droite / bas : skip si le clic est en fait sur une scrollbar.
    // L'utilisateur peut alors cliquer la scrollbar (un peu en retrait) sans
    // redimensionner la fenêtre par accident.
    if (direction === 'Right' && clickOverlapsScrollbar(e, 'right')) return;
    if (direction === 'Bottom' && clickOverlapsScrollbar(e, 'bottom')) return;
    if (direction === 'BottomRight') {
      if (clickOverlapsScrollbar(e, 'right') || clickOverlapsScrollbar(e, 'bottom')) return;
    }
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.startResizeDragging(direction as any);
  }
</script>

{#if !isMaximized}
  <div class="resize-edge top" role="presentation" data-no-drag onmousedown={(e) => startResize(e, 'Top')}></div>
  <div class="resize-edge bottom" role="presentation" data-no-drag onmousedown={(e) => startResize(e, 'Bottom')}></div>
  <div class="resize-edge left" role="presentation" data-no-drag onmousedown={(e) => startResize(e, 'Left')}></div>
  <div class="resize-edge right" role="presentation" data-no-drag onmousedown={(e) => startResize(e, 'Right')}></div>
{/if}
<div class="resize-corner top-left" role="presentation" data-no-drag onmousedown={(e) => startResize(e, 'TopLeft')}></div>
<div class="resize-corner top-right" role="presentation" data-no-drag onmousedown={(e) => startResize(e, 'TopRight')}></div>
<div class="resize-corner bottom-left" role="presentation" data-no-drag onmousedown={(e) => startResize(e, 'BottomLeft')}></div>
<div class="resize-corner bottom-right" role="presentation" data-no-drag onmousedown={(e) => startResize(e, 'BottomRight')}></div>

<style>
  /* Resize edges — invisible drag zones on window borders. Largeur 3px (au lieu
     de 6px) pour limiter le conflit avec les scrollbars natives qui font 8px
     dans MiraMD : seule la frange extrême du bord déclenche le curseur e-resize,
     laissant ~5px de scrollbar parfaitement cliquable avec le curseur normal.
     Les corners sont aussi resserrés (12px → 8px) pour cohérence. */
  .resize-edge, .resize-corner { position: fixed; z-index: 99999; }
  .resize-edge.top { top: 0; left: 8px; right: 8px; height: 3px; cursor: n-resize; }
  .resize-edge.bottom { bottom: 0; left: 8px; right: 8px; height: 3px; cursor: s-resize; }
  .resize-edge.left { left: 0; top: 8px; bottom: 8px; width: 3px; cursor: w-resize; }
  .resize-edge.right { right: 0; top: 8px; bottom: 8px; width: 3px; cursor: e-resize; }
  .resize-corner.top-left { top: 0; left: 0; width: 8px; height: 8px; cursor: nw-resize; }
  .resize-corner.top-right { top: 0; right: 0; width: 8px; height: 8px; cursor: ne-resize; }
  .resize-corner.bottom-left { bottom: 0; left: 0; width: 8px; height: 8px; cursor: sw-resize; }
  .resize-corner.bottom-right { bottom: 0; right: 0; width: 8px; height: 8px; cursor: se-resize; }
</style>
