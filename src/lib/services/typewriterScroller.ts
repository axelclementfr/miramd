import { muyaService } from '$lib/services/muya';

/**
 * Typewriter mode: keeps the cursor vertically centered in the editor pane.
 * Throttled to max once per 50ms to avoid layout thrashing.
 */
export function initTypewriterScroller(
  getPaneElement: () => HTMLElement | null,
  isEnabled: () => boolean
): (() => void)[] {
  let twTimer: ReturnType<typeof setTimeout> | null = null;
  const cleanups: (() => void)[] = [];

  const typewriterScroll = () => {
    if (!isEnabled()) return;
    const paneElement = getPaneElement();
    if (!paneElement) return;
    if (twTimer) return; // Throttle: max once per 50ms
    twTimer = setTimeout(() => {
      twTimer = null;
      requestAnimationFrame(() => {
        const pane = getPaneElement();
        if (!pane) return;
        const scrollTarget = pane.scrollHeight > pane.clientHeight
          ? pane
          : document.querySelector('.wysiwyg-pane') as HTMLElement;
        if (!scrollTarget) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect || rect.top === 0) return;
        const paneRect = scrollTarget.getBoundingClientRect();
        const offset = rect.top - paneRect.top - paneRect.height / 2;
        scrollTarget.scrollBy({ top: offset, behavior: 'smooth' });
      });
    }, 50);
  };

  cleanups.push(muyaService.onSelectionChange(typewriterScroll));
  cleanups.push(muyaService.onChange(typewriterScroll));

  const keyupHandler = () => {
    if (isEnabled()) setTimeout(typewriterScroll, 10);
  };
  const clickHandler = () => {
    if (isEnabled()) setTimeout(typewriterScroll, 50);
  };
  document.addEventListener('keyup', keyupHandler, true);
  document.addEventListener('mouseup', clickHandler, true);
  cleanups.push(() => {
    document.removeEventListener('keyup', keyupHandler, true);
    document.removeEventListener('mouseup', clickHandler, true);
  });

  return cleanups;
}
