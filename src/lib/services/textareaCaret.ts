/**
 * Mesure la position visuelle (Y en px depuis le haut de la textarea) du
 * caret correspondant à un offset dans `textarea.value`. Gère correctement
 * le line-wrap (white-space: pre-wrap + word-break: break-word) en clonant
 * les métriques de la textarea dans un div hors-flow.
 *
 * Approche standard de la lib `textarea-caret-position`. Utilisé par FindBar
 * (scroll vers le match) et TocPane (scroll vers un heading en source mode).
 */
export function caretYInTextarea(ta: HTMLTextAreaElement, offset: number): number {
	const cs = getComputedStyle(ta);
	const mirror = document.createElement('div');
	mirror.style.position = 'fixed';
	mirror.style.visibility = 'hidden';
	mirror.style.top = '0';
	mirror.style.left = '-9999px';
	mirror.style.boxSizing = cs.boxSizing;
	mirror.style.width = `${ta.clientWidth}px`;
	mirror.style.whiteSpace = 'pre-wrap';
	mirror.style.wordWrap = 'break-word';
	mirror.style.overflowWrap = 'break-word';
	const copyProps = [
		'font', 'lineHeight', 'fontKerning', 'fontFeatureSettings', 'fontVariantLigatures',
		'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
		'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
		'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
		'tabSize', 'letterSpacing', 'wordSpacing', 'textIndent', 'textTransform',
	] as const;
	for (const p of copyProps) {
		mirror.style[p] = cs[p];
	}
	mirror.textContent = ta.value.substring(0, offset);
	const sentinel = document.createElement('span');
	sentinel.textContent = '​';
	mirror.appendChild(sentinel);
	document.body.appendChild(mirror);
	const y = sentinel.offsetTop;
	document.body.removeChild(mirror);
	return y;
}

/** Centre verticalement le caret à `offset` dans le viewport visible de la textarea. */
export function scrollTextareaToOffset(ta: HTMLTextAreaElement, offset: number): void {
	const y = caretYInTextarea(ta, offset);
	if (y < 0) return;
	const target = y - ta.clientHeight / 2;
	const max = ta.scrollHeight - ta.clientHeight;
	ta.scrollTop = Math.max(0, Math.min(max, target));
}
