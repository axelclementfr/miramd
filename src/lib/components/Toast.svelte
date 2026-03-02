<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { toasts, dismissToast } from '$lib/stores/toast';

  let items: { id: string; text: string; kind: string; duration?: number }[] = $state([]);
  onMount(() => {
    const unsub = toasts.subscribe((t) => (items = t));
    return unsub;
  });

  const icons: Record<string, string> = {
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
    success: '✓',
  };
</script>

<div class="toast-container" role="alert" aria-live="polite">
  {#each items as toast (toast.id)}
    <div
      class="toast toast-{toast.kind}"
      in:fly={{ y: 40, duration: 200 }}
      out:fade={{ duration: 150 }}
    >
      <span class="toast-icon">{icons[toast.kind]}</span>
      <span class="toast-text">{toast.text}</span>
      <button class="toast-close" onclick={() => dismissToast(toast.id)} aria-label="Close">×</button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 36px;
    right: 16px;
    z-index: 9999;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    max-width: 400px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-family: var(--font-family, system-ui, sans-serif);
    color: #fff;
    background: var(--bg-toast, #333);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    min-width: 250px;
  }

  .toast-error {
    background: var(--danger, #c0392b);
  }

  .toast-warning {
    background: var(--warning, #e67e22);
  }

  .toast-info {
    background: var(--accent, #2980b9);
  }

  .toast-success {
    background: var(--success, #27ae60);
  }

  .toast-icon {
    flex-shrink: 0;
    font-size: 14px;
    font-weight: bold;
  }

  .toast-text {
    flex: 1;
    line-height: 1.4;
  }

  .toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 16px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
  }

  .toast-close:hover {
    color: #fff;
  }
</style>
