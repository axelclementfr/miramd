<script lang="ts" module>
  export interface ContextMenuItemSeparator {
    type: 'separator';
  }
  export interface ContextMenuItemAction {
    type: 'item';
    label: string;
    /** SVG `d` attribute for an optional icon. ViewBox default "0 0 24 24". */
    iconPath?: string;
    iconViewBox?: string;
    onClick: () => unknown;
    disabled?: boolean;
  }
  export interface ContextMenuItemSubmenu {
    type: 'submenu';
    label: string;
    iconPath?: string;
    iconViewBox?: string;
    children: ContextMenuItem[];
    disabled?: boolean;
  }
  export type ContextMenuItem = ContextMenuItemSeparator | ContextMenuItemAction | ContextMenuItemSubmenu;
</script>

<script lang="ts">
  interface Props {
    position: { x: number; y: number } | null;
    items: ContextMenuItem[];
    onclose: () => void;
  }
  let { position, items, onclose }: Props = $props();

  let hoveredSubmenuIndex: number | null = $state(null);

  function close() { hoveredSubmenuIndex = null; onclose(); }

  async function handleItemClick(item: ContextMenuItemAction) {
    if (item.disabled) return;
    close();
    await Promise.resolve(item.onClick());
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }
</script>

{#if position}
  <!-- `data-no-drag` empêche `setupWindowDrag()` de consommer le mousedown
       sur le backdrop pour démarrer un drag de fenêtre Tauri. -->
  <div
    class="ctx-backdrop"
    data-no-drag
    role="presentation"
    onmousedown={close}
    oncontextmenu={(e) => { e.preventDefault(); close(); }}
    onkeydown={handleKeydown}
  ></div>
  <div class="ctx-menu" data-no-drag style="top: {position.y}px; left: {position.x}px;" role="menu">
    {#each items as item, i (i)}
      {#if item.type === 'separator'}
        <div class="ctx-sep" role="separator"></div>
      {:else if item.type === 'item'}
        <button
          class="ctx-item"
          role="menuitem"
          disabled={item.disabled}
          onclick={() => handleItemClick(item)}
          onmouseenter={() => (hoveredSubmenuIndex = null)}
        >
          {#if item.iconPath}
            <svg width="14" height="14" viewBox={item.iconViewBox ?? '0 0 24 24'} fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d={item.iconPath}/>
            </svg>
          {:else}
            <span class="ctx-icon-spacer"></span>
          {/if}
          <span class="ctx-label">{item.label}</span>
        </button>
      {:else if item.type === 'submenu'}
        <div
          class="ctx-sub-wrap"
          role="none"
          onmouseenter={() => (hoveredSubmenuIndex = i)}
        >
          <button
            class="ctx-item"
            class:active={hoveredSubmenuIndex === i}
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={hoveredSubmenuIndex === i}
            disabled={item.disabled}
          >
            {#if item.iconPath}
              <svg width="14" height="14" viewBox={item.iconViewBox ?? '0 0 24 24'} fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d={item.iconPath}/>
              </svg>
            {:else}
              <span class="ctx-icon-spacer"></span>
            {/if}
            <span class="ctx-label">{item.label}</span>
            <svg class="ctx-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <polygon points="2,1 8,5 2,9" fill="currentColor"/>
            </svg>
          </button>
          {#if hoveredSubmenuIndex === i}
            <div class="ctx-sub-menu" role="menu" data-no-drag>
              {#each item.children as child, j (j)}
                {#if child.type === 'separator'}
                  <div class="ctx-sep" role="separator"></div>
                {:else if child.type === 'item'}
                  <button
                    class="ctx-item"
                    role="menuitem"
                    disabled={child.disabled}
                    onclick={() => handleItemClick(child)}
                  >
                    {#if child.iconPath}
                      <svg width="14" height="14" viewBox={child.iconViewBox ?? '0 0 24 24'} fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d={child.iconPath}/>
                      </svg>
                    {:else}
                      <span class="ctx-icon-spacer"></span>
                    {/if}
                    <span class="ctx-label">{child.label}</span>
                  </button>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}

<svelte:window onkeydown={handleKeydown} />

<style>
  .ctx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: transparent;
  }
  .ctx-menu {
    position: fixed;
    z-index: 1001;
    min-width: 200px;
    padding: 4px;
    background: var(--floatBgColor, var(--bg-sidebar));
    color: var(--sideBarColor, var(--text-primary));
    border: none;
    border-radius: 6px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
    font-family: var(--font-family);
    font-size: 13px;
    user-select: none;
  }
  .ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    background: none;
    border: none;
    outline: none;
    color: inherit;
    text-align: left;
    cursor: default;
    border-radius: 4px;
    font: inherit;
  }
  .ctx-item:hover:not(:disabled),
  .ctx-item.active:not(:disabled) {
    background: var(--sideBarItemHoverBgColor, var(--bg-hover));
  }
  .ctx-item:focus,
  .ctx-item:focus-visible {
    outline: none;
    box-shadow: none;
  }
  .ctx-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .ctx-icon-spacer { display: inline-block; width: 14px; }
  .ctx-label { flex: 1; }
  .ctx-chevron {
    opacity: 0.6;
    margin-left: 8px;
  }
  .ctx-sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--editorColor10, rgba(255, 255, 255, 0.08));
  }
  .ctx-sub-wrap {
    position: relative;
  }
  .ctx-sub-menu {
    position: absolute;
    top: -4px;
    left: 100%;
    margin-left: 2px;
    min-width: 220px;
    padding: 4px;
    background: var(--floatBgColor, var(--bg-sidebar));
    color: var(--sideBarColor, var(--text-primary));
    border-radius: 6px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
    z-index: 1002;
    max-height: 320px;
    overflow-y: auto;
  }
</style>
