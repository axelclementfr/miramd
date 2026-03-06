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

export interface TypewriterController {
  /** Cleanup functions to push into the unsub list of the host component. */
  cleanups: (() => void)[];
  /**
   * Force a re-center now, bypassing the throttle. Use after events that the
   * built-in triggers don't catch: file open, tab switch, mode toggle. Has no
   * effect when the mode is disabled.
   */
  trigger: () => void;
}

/**
 * Typewriter mode: keeps the cursor vertically centered in the editor pane.
 * Triggers built-in: Muya onChange, Muya onSelectionChange, document keyup,
 * document mouseup. The host wires `trigger()` for events the editor itself
 * doesn't emit (initial mount, tab switch, mode enable).
 *
 * Throttled to max once per 50 ms via the internal scheduler — except for
 * external `trigger()` calls, which run on the next animation frame so a tab
 * switch or mode flip lands the cursor immediately at center.
 */
export function initTypewriterScroller(
  getPaneElement: () => HTMLElement | null,
  isEnabled: () => boolean,
): TypewriterController {
  let twTimer: ReturnType<typeof setTimeout> | null = null;
  const cleanups: (() => void)[] = [];

  function scrollToCenter(): void {
    const pane = getPaneElement();
    if (!pane) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const offset = computeTypewriterOffset(range, pane);
    if (offset === null) return;
    pane.scrollBy({ top: offset, behavior: 'smooth' });
  }

  const typewriterScroll = () => {
    if (!isEnabled()) return;
    const paneElement = getPaneElement();
    if (!paneElement) return;
    if (twTimer) return; // Throttle: max once per 50 ms
    twTimer = setTimeout(() => {
      twTimer = null;
      requestAnimationFrame(scrollToCenter);
    }, 50);
  };

  const trigger = () => {
    if (!isEnabled()) return;
    if (twTimer) {
      clearTimeout(twTimer);
      twTimer = null;
    }
    requestAnimationFrame(scrollToCenter);
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

  return { cleanups, trigger };
}
