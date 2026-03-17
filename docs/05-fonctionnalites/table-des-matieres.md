# Table des matières (TOC)

La table des matières affiche, dans la barre latérale, l'arbre des titres du document courant. Cliquer sur une entrée fait défiler l'éditeur jusqu'au titre correspondant. C'est utile pour naviguer rapidement dans un long document.

## Vue utilisateur

**Affichage.**

- La TOC vit dans la **sidebar**, dans le pane "Table des matières".
- Pour l'ouvrir : clic sur l'icône TOC dans la barre d'icônes verticale de la sidebar (ou via le raccourci sidebar `Ctrl+B` puis sélection de l'onglet TOC).
- Les titres sont affichés en arborescence : un `# Titre` est au niveau 0, ses `## Sous-titres` sont indentés en niveau 1, etc., jusqu'à `######`.

**Interaction.**

- Cliquer sur une entrée fait défiler l'éditeur jusqu'au titre correspondant (avec animation `scrollIntoView({ behavior: 'smooth' })`) et applique brièvement un effet de surbrillance pour indiquer la cible.
- Les noeuds avec enfants ont une flèche cliquable pour replier/déplier la section. La feuille (titre sans enfant) n'a pas de flèche.

**Mise à jour.**

- Quand tu tapes dans le document, la TOC se met à jour à chaque frappe (le composant souscrit à `editor.activeTab`, qui est dérivé de la liste des onglets ; chaque mise à jour de contenu re-déclenche l'extraction). Sans débounce — la fonction d'extraction est suffisamment rapide (O(N) sur le markdown) pour que ce soit imperceptible dans les cas usuels.
- Au changement d'onglet, la TOC se redessine pour refléter le contenu de l'onglet actif.

**Quand la TOC est vide.** Si le document n'a aucun titre, le pane affiche une illustration "vide" plutôt qu'une liste vide.

## Implémentation

L'extraction des titres est une fonction pure dans `src/lib/services/toc.ts`. Pas d'AST complet, mais une **state machine ligne par ligne** qui sait ignorer les `#` posés à l'intérieur d'un fenced code block ou d'un frontmatter YAML.

**Composants Svelte concernés** :

- `src/lib/components/sidebar/TocPane.svelte` — affiche la TOC. Construit un arbre `TocNode[]` à partir de la liste plate retournée par `extractHeadings()`, gère les clics pour scroll-into-view et le repli des sections.
- `src/lib/components/sidebar/Sidebar.svelte` — orchestre les différents panes (Files, Search, TOC). Active le pane TOC quand l'utilisateur clique sur son icône.

**Service partagé** : `src/lib/services/toc.ts` expose `extractHeadings(content: string): TocEntry[]`. Une seule source de vérité, testée à part dans `tests/services/toc.test.ts` (22 cas).

**Logique d'extraction (résumé)** :

- Détection initiale du frontmatter : si la ligne 0 est exactement `---`, scanner jusqu'au prochain `---` non-initial. Tout ce qui est entre les deux est ignoré. Si le délimiteur de fermeture n'est jamais trouvé, retourner `[]` (défensif — un frontmatter ouvert sans fermeture indique souvent un fichier en cours d'édition).
- Boucle principale : pour chaque ligne, garder un état `fence: { char: '`' | '~', minLen: number } | null`.
  - Si on est dans une fence, ignorer les `#` et chercher la ligne de fermeture (CommonMark : 0-3 spaces d'indent + au moins `minLen` du même caractère + optional whitespace).
  - Sinon, chercher l'ouverture d'une fence avec `^\s{0,3}(\`{3,}|~{3,})`.
  - Sinon, chercher un titre ATX avec `^(#{1,6})\s+(.+)` (le `^` empêche les lignes indentées de matcher).
- Le `pos` retourné est l'offset en bytes du début de la ligne, utile pour le scroll par index (voir plus bas).

**Backend Rust impliqué** : aucun. Tout est calculé côté frontend. La piste "comrak côté Rust" mentionnée dans une version antérieure de cette doc est devenue moot — la state machine couvre les cas qui posaient problème.

**Stores impactés** :

- `editor.activeTab` — quand le contenu de l'onglet actif change (ou quand on change d'onglet), le subscribe dans `TocPane.svelte` re-construit l'arbre. Pas de store `editor.toc` dédié — c'était du code mort, supprimé.

**Scroll vers un titre.** Implémentation dans `TocPane.scrollToHeading(targetPos)` :

```ts
function scrollToHeading(targetPos: number) {
  const tab = get(editor.activeTab);
  if (!tab) return;
  const flat = extractHeadings(tab.content);
  const index = flat.findIndex((h) => h.pos === targetPos);
  if (index < 0) return;

  const container = document.querySelector('.muya-editor');
  if (!container) return;

  const wysiwygPane = container.closest('.wysiwyg-pane');
  if (wysiwygPane?.classList.contains('hidden')) {
    dlog('toc', 'scrollToHeading: .wysiwyg-pane is hidden (source mode), skipping.');
    return;
  }

  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const target = headings[index];
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('toc-highlight');
  setTimeout(() => target.classList.remove('toc-highlight'), 1500);
}
```

Trois choix non-évidents méritent d'être expliqués :

- **Sélecteur `.muya-editor` au lieu de `[contenteditable="true"]`**. Le second échoue silencieusement quand le contenteditable est forcé à false : tab en lock mode (per-tab readOnly), mode split avec sourceCodeMode, mode source pur (Muya hidden). `.muya-editor` est toujours présent dans le DOM dès l'init.
- **Match par index plutôt que par texte**. La fonction reçoit la position source (`targetPos`), pas le texte. On cherche l'index de cette position dans la liste plate des headings, puis on prend le Nème `<hN>` du DOM Muya. Les headings dupliqués (même texte) sont gérés correctement.
- **Détection explicite du Muya hidden**. En pure source mode, `.muya-editor` existe mais son ancêtre `.wysiwyg-pane` a la classe `hidden` (`display: none`). `scrollIntoView` sur un élément invisible est silencieusement no-op. On détecte le cas et on log via `dlog('toc', ...)` au lieu de laisser le user perplexe.

## Pièges connus

- **HTML brut non détecté** : un titre écrit en HTML (`<h2>...</h2>`) n'apparaît pas dans la TOC. La state machine ne traite que le format ATX (`#` à `######`). Acceptable car écrire du HTML dans un fichier Markdown est rare dans MiraMD.

- **Lignes indentées intentionnelles** : un `   # Titre` (avec espaces avant) n'est pas reconnu — c'est conforme à la spec CommonMark (les headings ATX doivent commencer à la colonne 0), mais peut surprendre.

- **Frontmatter unclosed = TOC vide** : si le document commence par `---` sans fermeture, on retourne `[]`. Choix défensif (le contenu après `---` est sémantiquement dans le frontmatter), mais peut donner l'impression que la feature est cassée. Vérifier qu'on a bien un second `---` qui clôt le bloc.

- **Pas de navigation TOC en mode source pur** : quand l'éditeur Muya est masqué (mode source sans split), le clic TOC ne fait rien (avec un log via `dlog('toc', ...)` pour expliquer pourquoi). Pour naviguer, repasser en mode normal ou split.

## Pour aller plus loin

- [`mode-debug.md`](mode-debug.md) — sujet `'toc'` activable via Ctrl+Shift+D pour tracer pourquoi un clic ne navigue pas.
- [`edition-wysiwyg.md`](edition-wysiwyg.md) — comment les modifications de contenu déclenchent la régénération.
- [`recherche.md`](recherche.md) — fonctionnalité voisine dans la sidebar, qui utilise un mécanisme similaire de scroll-into-view.
- [`../06-references/problemes-connus.md`](../06-references/problemes-connus.md) — section "Résolus" pour l'historique du bug TOC.
