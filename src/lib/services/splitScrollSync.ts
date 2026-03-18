/**
 * Sync de scroll entre deux conteneurs (utilisé en mode split source ↔ preview).
 * Approche proportionnelle : on garde la même fraction parcourue de chaque côté.
 * Pas exact si les hauteurs rendues divergent fortement (images, code blocks, etc.)
 * mais suffisant pour "l'aperçu suit le scroll source".
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
