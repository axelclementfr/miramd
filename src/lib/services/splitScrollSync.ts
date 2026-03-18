/**
 * Sync de scroll entre source et preview en mode split.
 *
 * Deux stratégies :
 * - `computeProportionalScroll` : fallback simple, garde la même fraction parcourue.
 *   Imprécis quand les hauteurs rendues divergent (images, blocs de code).
 * - `computeAnchoredScroll` : utilise des points d'ancrage (typiquement les headings)
 *   pour aligner exactement à chaque ancre, et interpole proportionnellement entre
 *   deux ancres. Beaucoup plus précis pour des docs avec des headings réguliers.
 */

export function computeProportionalScroll(
  srcScrollTop: number,
  srcMaxScroll: number,
  dstMaxScroll: number,
): number {
  if (dstMaxScroll <= 0) return 0;
  if (srcMaxScroll <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, srcScrollTop / srcMaxScroll));
  return Math.round(ratio * dstMaxScroll);
}

export interface ScrollAnchor {
  /** Position dans la source (typiquement un offset de caractère). */
  srcPos: number;
  /** Position pixel dans la preview (offsetTop de l'élément correspondant). */
  dstTop: number;
}

/**
 * Aligne exactement à chaque ancre, interpole linéairement entre.
 * Au-dessus de la 1ère ancre : interpole entre (0, 0) et la 1ère.
 * Au-dessous de la dernière : interpole entre la dernière et (srcLength, dstScrollHeight).
 * Sans ancres : fallback proportionnel sur srcLength → dstMaxScroll.
 *
 * Le résultat est clampé dans [0, dstMaxScroll].
 */
export function computeAnchoredScroll(
  srcCharPos: number,
  srcLength: number,
  anchors: ScrollAnchor[],
  dstMaxScroll: number,
  dstScrollHeight: number,
): number {
  if (dstMaxScroll <= 0) return 0;

  if (anchors.length === 0) {
    if (srcLength <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, srcCharPos / srcLength));
    return Math.round(ratio * dstMaxScroll);
  }

  // Find the last anchor with srcPos <= srcCharPos
  let prevIdx = -1;
  for (let i = 0; i < anchors.length; i++) {
    if (anchors[i].srcPos <= srcCharPos) prevIdx = i;
    else break;
  }

  const prevSrc = prevIdx >= 0 ? anchors[prevIdx].srcPos : 0;
  const prevDst = prevIdx >= 0 ? anchors[prevIdx].dstTop : 0;
  const hasNext = prevIdx + 1 < anchors.length;
  const nextSrc = hasNext ? anchors[prevIdx + 1].srcPos : srcLength;
  const nextDst = hasNext ? anchors[prevIdx + 1].dstTop : dstScrollHeight;

  const segLen = nextSrc - prevSrc;
  const fraction = segLen > 0 ? (srcCharPos - prevSrc) / segLen : 0;
  const target = prevDst + fraction * (nextDst - prevDst);

  return Math.max(0, Math.min(dstMaxScroll, Math.round(target)));
}
