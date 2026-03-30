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

/** Buffer en pixels AUTOUR de la zone scrollbar où le drag est aussi désactivé.
 *  Évite les faux positifs quand le clic atterrit pile à la frontière intérieure
 *  de la scrollbar (entre le contenu et la scrollbar) — l'utilisateur perçoit
 *  qu'il a cliqué sur la scrollbar, le windowDrag ne doit pas réagir. */
const SCROLLBAR_BUFFER_PX = 4;

/** True si le mousedown vise la scrollbar native (verticale à droite ou
 *  horizontale en bas) de N'IMPORTE QUEL ancêtre scrollable de la target.
 *
 *  Sans cette détection, `setupWindowDrag` intercepte les clics scrollbar
 *  comme s'ils étaient sur du contenu vide → la fenêtre se déplace au lieu
 *  de scroller.
 *
 *  Technique : on remonte l'arbre depuis `e.target`. Pour chaque ancêtre qui
 *  a `overflow: auto/scroll` ET un contenu plus grand que sa client area,
 *  on calcule les coordonnées absolues du clic relatives à cet ancêtre via
 *  `getBoundingClientRect`. Si le clic tombe dans la zone scrollbar (ou son
 *  buffer), on retourne true. Plus robuste que `e.offsetX > target.clientWidth`
 *  seul, qui rate les cas où la target n'est pas l'élément scrollable lui-même
 *  (e.g. clic sur un span enfant proche du bord). */
export function isScrollbarHit(e: MouseEvent): boolean {
	if (!(e.target instanceof Element)) return false;
	let node: Element | null = e.target;
	while (node && node !== document.documentElement.parentElement) {
		if (!(node instanceof HTMLElement)) {
			node = node.parentElement;
			continue;
		}
		const cs = getComputedStyle(node);
		const canScrollY =
			(cs.overflowY === 'auto' || cs.overflowY === 'scroll') && node.scrollHeight > node.clientHeight;
		const canScrollX =
			(cs.overflowX === 'auto' || cs.overflowX === 'scroll') && node.scrollWidth > node.clientWidth;
		if (canScrollY || canScrollX) {
			const rect = node.getBoundingClientRect();
			const borderL = parseFloat(cs.borderLeftWidth) || 0;
			const borderT = parseFloat(cs.borderTopWidth) || 0;
			const x = e.clientX - rect.left - borderL;
			const y = e.clientY - rect.top - borderT;
			// Vertical scrollbar zone = au-delà de clientWidth, avec buffer
			if (canScrollY && x > node.clientWidth - SCROLLBAR_BUFFER_PX) return true;
			// Horizontal scrollbar zone = au-delà de clientHeight, avec buffer
			if (canScrollX && y > node.clientHeight - SCROLLBAR_BUFFER_PX) return true;
		}
		node = node.parentElement;
	}
	return false;
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
		// Scrollbar : pas un drag target — laisse le browser scroll nativement.
		if (isScrollbarHit(e)) return;
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
