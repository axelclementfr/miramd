/**
 * Typewriter padding service. Applies vertical padding equal to half the
 * pane's height on top and bottom of the Muya editor when typewriter mode
 * is active, so that the first and last lines of the document can actually
 * scroll to the vertical center.
 *
 * Implementation: inline styles on the Muya container. This wins specificity
 * against editor.css's `padding: 20px clamp(...) 100px` rule on
 * `.wysiwyg-pane > div[contenteditable]` (same specificity, would lose by
 * source order if we used a CSS rule). It also gives us an exact half-pane
 * height instead of the approximate 50vh, which matters when the pane is
 * shorter than the viewport (status bar, tab bar, etc.).
 *
 * The pane height can change (sidebar toggle, window resize, font scaling),
 * so the service installs a ResizeObserver to keep the padding in sync.
 */
export interface TypewriterPaddingController {
  setActive: (active: boolean) => void;
  destroy: () => void;
}

export function initTypewriterPadding(
  getPane: () => HTMLElement | null,
): TypewriterPaddingController {
  let active = false;
  let observer: ResizeObserver | null = null;

  function getContainer(): HTMLElement | null {
    const pane = getPane();
    if (!pane) return null;
    return pane.querySelector('.muya-editor') as HTMLElement | null;
  }

  function apply(): void {
    const pane = getPane();
    const container = getContainer();
    if (!pane || !container) return;
    const half = Math.max(0, Math.floor(pane.clientHeight / 2));
    container.style.paddingTop = `${half}px`;
    container.style.paddingBottom = `${half}px`;
  }

  function clear(): void {
    const container = getContainer();
    if (!container) return;
    container.style.removeProperty('padding-top');
    container.style.removeProperty('padding-bottom');
  }

  function startObserving(): void {
    const pane = getPane();
    if (!pane || typeof ResizeObserver === 'undefined') return;
    if (observer) observer.disconnect();
    observer = new ResizeObserver(() => {
      if (active) apply();
    });
    observer.observe(pane);
  }

  function stopObserving(): void {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function setActive(value: boolean): void {
    if (value === active) return;
    active = value;
    if (active) {
      apply();
      startObserving();
    } else {
      clear();
      stopObserving();
    }
  }

  function destroy(): void {
    clear();
    stopObserving();
    active = false;
  }

  return { setActive, destroy };
}
