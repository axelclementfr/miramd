/**
 * Helpers DOM pures pour le highlight visuel en mode split (preview pane) :
 * - retrouver le n-ième mot exact (word-boundary) dans un sous-arbre DOM
 * - envelopper un Range dans un span dédié, et l'enlever proprement
 * - retrouver le bloc rendu (h*, p, ul, ol, etc.) le plus proche d'un Y donné
 *
 * Extrait de SourcePane.svelte pour pouvoir être testé en JSDOM sans monter
 * le composant Svelte entier.
 */

const HIGHLIGHT_CLASS = 'split-word-highlight';
const OUTLINE_CLASS = 'split-click-target';

/** Échappe les caractères spéciaux regex dans une chaîne. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Walk text nodes inside `root` and return a Range surrounding the
 * `occurrenceIndex`-th word-boundary occurrence of `word`.
 * Word-boundary (`\b...\b`) évite de matcher "the" dans "weather".
 *
 * Returns null si :
 * - le mot est vide
 * - aucun text node ne contient une occurrence
 * - occurrenceIndex dépasse le nombre d'occurrences trouvées
 */
export function findTextOccurrence(root: Node, word: string, occurrenceIndex: number): Range | null {
  if (!word || word.length === 0) return null;
  if (occurrenceIndex < 0) return null;

  const re = new RegExp('\\b' + escapeRegex(word) + '\\b', 'g');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent || '';
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (count === occurrenceIndex) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + word.length);
        return range;
      }
      count++;
    }
  }
  return null;
}

/**
 * Compte le nombre d'occurrences word-boundary du mot dans `source[0..upTo]`.
 * Sert à savoir quel index d'occurrence correspond à la position du curseur.
 */
export function countWordOccurrencesBefore(source: string, word: string, upTo: number): number {
  if (!word || word.length === 0) return 0;
  const re = new RegExp('\\b' + escapeRegex(word) + '\\b', 'g');
  const before = source.substring(0, Math.max(0, upTo));
  let count = 0;
  while (re.exec(before) !== null) count++;
  return count;
}

/**
 * Remplace `span` par ses enfants dans le parent, puis le supprime.
 * Normalize() pour fusionner les text nodes adjacents (évite la fragmentation
 * du DOM après plusieurs cycles wrap/unwrap).
 * Safe : no-op si span n'a pas de parent (déjà détaché).
 */
export function unwrapSpan(span: HTMLSpanElement): void {
  const parent = span.parentNode;
  if (!parent) return;
  while (span.firstChild) parent.insertBefore(span.firstChild, span);
  parent.removeChild(span);
  if ('normalize' in parent) (parent as Element).normalize();
}

/**
 * Highlight le mot exact double-cliqué dans la source, retrouvé dans la preview.
 * Approche span-wrapping : on enveloppe le range trouvé dans un span dédié.
 *
 * Renvoie le span créé (pour gestion du timer de suppression) ou null si :
 * - le mot est vide
 * - le mot n'est pas trouvable dans le pane (ex: rendu différent du source)
 * - le range traverse une frontière d'élément (rare, surroundContents échoue)
 *
 * NB : ne nettoie pas les highlights précédents — appeler clearAllSplitHighlights
 * avant si nécessaire.
 */
export function highlightWordInPreview(
  pane: HTMLElement,
  source: string,
  selStart: number,
  selEnd: number,
): HTMLSpanElement | null {
  const word = source.substring(selStart, selEnd);
  if (!word.trim() || word.length === 0) return null;

  const occurrenceIndex = countWordOccurrencesBefore(source, word, selStart);
  const range = findTextOccurrence(pane, word, occurrenceIndex);
  if (!range) return null;

  const span = document.createElement('span');
  span.className = HIGHLIGHT_CLASS;
  try {
    range.surroundContents(span);
  } catch {
    return null;
  }
  return span;
}

/**
 * Retire tous les highlights actifs dans la preview :
 * - tous les `<span class="split-word-highlight">` (unwrap chaque)
 * - la classe `split-click-target` sur tous les éléments qui la portent
 *
 * Robuste : couvre les leftovers après re-render Muya, double-clics rapides
 * cross-blocs, etc. No-op si pane est null.
 */
export function clearAllSplitHighlights(pane: HTMLElement | null): void {
  if (!pane) return;
  const wraps = pane.querySelectorAll('.' + HIGHLIGHT_CLASS);
  wraps.forEach((s) => unwrapSpan(s as HTMLSpanElement));
  const outlined = pane.querySelectorAll('.' + OUTLINE_CLASS);
  outlined.forEach((el) => el.classList.remove(OUTLINE_CLASS));
}

/**
 * Trouve le bloc rendu (h1-6, p, ul, ol, blockquote, pre, table, hr) dont
 * `offsetTop` est le plus proche de `scrollTop + alignOffsetY` (= position
 * dans la preview viewport où l'utilisateur s'attend à voir l'élément cible).
 *
 * Renvoie null si aucun candidat n'est trouvé dans le pane.
 */
export function findTargetElement(
  pane: HTMLElement,
  scrollTop: number,
  alignOffsetY: number,
): HTMLElement | null {
  const targetContentY = scrollTop + alignOffsetY;
  const candidates = pane.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, table, hr');
  let best: HTMLElement | null = null;
  let bestDistance = Infinity;
  candidates.forEach((node) => {
    const el = node as HTMLElement;
    const distance = Math.abs(el.offsetTop - targetContentY);
    if (distance < bestDistance) {
      best = el;
      bestDistance = distance;
    }
  });
  return best;
}
