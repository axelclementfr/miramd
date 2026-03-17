<script lang="ts">
  let { isMaximized }: { isMaximized: boolean } = $props();

  async function startResize(_e: MouseEvent, direction: string) {
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
  /* Resize edges — invisible drag zones on window borders */
  .resize-edge, .resize-corner { position: fixed; z-index: 99999; }
  .resize-edge.top { top: 0; left: 8px; right: 8px; height: 6px; cursor: n-resize; }
  .resize-edge.bottom { bottom: 0; left: 8px; right: 8px; height: 6px; cursor: s-resize; }
  .resize-edge.left { left: 0; top: 8px; bottom: 8px; width: 6px; cursor: w-resize; }
  .resize-edge.right { right: 0; top: 8px; bottom: 8px; width: 6px; cursor: e-resize; }
  .resize-corner.top-left { top: 0; left: 0; width: 12px; height: 12px; cursor: nw-resize; }
  .resize-corner.top-right { top: 0; right: 0; width: 12px; height: 12px; cursor: ne-resize; }
  .resize-corner.bottom-left { bottom: 0; left: 0; width: 12px; height: 12px; cursor: sw-resize; }
  .resize-corner.bottom-right { bottom: 0; right: 0; width: 12px; height: 12px; cursor: se-resize; }
</style>
