<script lang="ts">
  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    options: Option[];
    value: string;
    onchange: (value: string) => void;
  }

  let { options, value, onchange }: Props = $props();
  let isOpen: boolean = $state(false);
  const listboxId = `listbox-${Math.random().toString(36).slice(2, 9)}`;

  function currentLabel(): string {
    return options.find((o) => o.value === value)?.label ?? value;
  }

  function select(val: string) {
    value = val;
    isOpen = false;
    onchange(val);
  }

  function toggle() {
    isOpen = !isOpen;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        isOpen = true;
      }
      return;
    }

    const idx = options.findIndex((o) => o.value === value);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % options.length;
      select(options[next].value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + options.length) % options.length;
      select(options[prev].value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isOpen = false;
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.custom-select')) {
      isOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="custom-select" role="combobox" aria-expanded={isOpen} aria-haspopup="listbox" aria-controls={listboxId}>
  <button class="cs-trigger" onclick={toggle} onkeydown={handleKeydown} aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={listboxId}>
    <span class="cs-value">{currentLabel()}</span>
    <svg class="cs-arrow" class:open={isOpen} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
  </button>

  {#if isOpen}
    <div class="cs-dropdown" role="listbox" id={listboxId}>
      {#each options as opt}
        <button
          class="cs-option"
          class:selected={opt.value === value}
          onclick={() => select(opt.value)}
          role="option"
          aria-selected={opt.value === value}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .custom-select {
    position: relative;
    min-width: 160px;
  }

  .cs-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 5px 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 5px;
    color: var(--text-primary);
    font-size: 0.8rem;
    font-family: var(--font-family);
    cursor: pointer;
    text-align: left;
    transition: border-color .12s ease;
  }

  .cs-trigger:hover {
    border-color: var(--accent);
  }

  .cs-value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cs-arrow {
    flex-shrink: 0;
    opacity: 0.5;
    transition: transform .15s ease;
  }

  .cs-arrow.open {
    transform: rotate(180deg);
  }

  .cs-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 200px;
    overflow-y: auto;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 5px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 100;
    padding: 3px;
  }

  .cs-dropdown::-webkit-scrollbar { width: 5px; }
  .cs-dropdown::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }

  .cs-option {
    display: block;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 3px;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.78rem;
    font-family: var(--font-family);
    cursor: pointer;
    text-align: left;
    transition: background .08s ease;
  }

  .cs-option:hover {
    background: var(--bg-hover);
  }

  .cs-option.selected {
    color: var(--accent);
    font-weight: 500;
  }
</style>
