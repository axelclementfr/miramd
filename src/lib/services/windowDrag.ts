/**
 * Global window drag : on Linux/WebKitGTK, the CSS `-webkit-app-region: drag`
 * is unreliable, so we route mousedown to Tauri's `startDragging()` programmatically.
 *
 * Any element matching INTERACTIVE_SELECTOR (or one of its ancestors) is excluded
 * from drag — covers buttons, links, form fields, the editor (contenteditable + textarea),
 * tab roles, separators (resize handles), and explicit opt-outs (`.no-drag`, `[data-no-drag]`).
 */

const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="treeitem"]',
  '[role="separator"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="alert"]',
  '.no-drag',
  '[data-no-drag]',
].join(',');

export function isDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(INTERACTIVE_SELECTOR) === null;
}

export function setupWindowDrag(): () => void {
  let appWindow: any = null;

  (async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      appWindow = getCurrentWindow();
    } catch (err) {
      console.error('[windowDrag] failed to get current window:', err);
    }
  })();

  async function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    if (!appWindow) return;
    if (!isDragTarget(e.target)) return;

    if (e.detail === 2) {
      await appWindow.toggleMaximize();
    } else {
      await appWindow.startDragging();
    }
  }

  document.addEventListener('mousedown', onMouseDown);
  return () => document.removeEventListener('mousedown', onMouseDown);
}
