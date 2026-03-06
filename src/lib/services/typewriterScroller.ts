import { muyaService } from '$lib/services/muya';

/**
 * Compute the y-offset to scroll so the cursor is vertically centered inside
 * `scrollTarget`. Returns null when no usable position can be measured (so the
 * caller skips the scroll instead of jumping wildly).
 *
 * Why this is a separate function: pressing Enter creates a fresh empty
 * paragraph, and `range.getBoundingClientRect()` on a collapsed range in an
 * empty inline-flow container returns an all-zero rect. The previous code
 * treated that as "no measurement possible" and silently skipped the recenter,
 * leaving the cursor below center until the user typed a character. Falling
 * back to the parent element's rect gives us a measurable position even on
 * empty paragraphs, matching how Muya itself measures cursor lines (see
 * src/lib/muya/lib/selection/index.js:598 — `paragraph.getBoundingClientRect()`).
 */
export function computeTypewriterOffset(range: Range, scrollTarget: HTMLElement): number | null {
  let cursorRect = range.getBoundingClientRect();
  if (!isUsefulRect(cursorRect)) {
    const node = range.startContainer;
    const parent = node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
    if (!parent) return null;
    cursorRect = parent.getBoundingClientRect();
    if (!isUsefulRect(cursorRect)) return null;
  }
  const paneRect = scrollTarget.getBoundingClientRect();
  return cursorRect.top - paneRect.top - paneRect.height / 2;
}

function isUsefulRect(r: DOMRect | undefined): boolean {
  if (!r) return false;
  // A rect with non-zero height is rendered. If everything is zero (top, left,
  // height, width) the element/range has no rendered position — treat as not
  // useful. Don't reject `top === 0` alone: that's legitimate at viewport top.
  return r.height > 0 || r.width > 0 || r.top !== 0 || r.left !== 0;
}

/**
 * Typewriter mode: keeps the cursor vertically centered in the editor pane.
 * Throttled to max once per 50 ms to avoid layout thrashing.
 */
export function initTypewriterScroller(
  getPaneElement: () => HTMLElement | null,
  isEnabled: () => boolean,
): (() => void)[] {
  let twTimer: ReturnType<typeof setTimeout> | null = null;
  const cleanups: (() => void)[] = [];

  const typewriterScroll = () => {
    if (!isEnabled()) return;
    const paneElement = getPaneElement();
    if (!paneElement) return;
    if (twTimer) return; // Throttle: max once per 50 ms
    twTimer = setTimeout(() => {
      twTimer = null;
      requestAnimationFrame(() => {
        const pane = getPaneElement();
        if (!pane) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const offset = computeTypewriterOffset(range, pane);
        if (offset === null) return;
        pane.scrollBy({ top: offset, behavior: 'smooth' });
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
