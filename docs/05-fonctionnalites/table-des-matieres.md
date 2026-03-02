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

- Quand tu tapes dans le document, la TOC se met à jour automatiquement, **avec un léger délai** ([debounce](../01-decouverte/glossaire.md#debounce) de 300 ms après la dernière frappe). Inutile de tout relancer manuellement.
- Au changement d'onglet, la TOC se redessine pour refléter le contenu de l'onglet actif.

**Quand la TOC est vide.** Si le document n'a aucun titre, le pane affiche une illustration "vide" plutôt qu'une liste vide.

## Implémentation

L'extraction des titres est faite côté frontend, par une regex sur le markdown brut. Pas d'AST, pas d'appel backend.

**Composants Svelte concernés** :

- `src/lib/components/sidebar/TocPane.svelte` — affiche la TOC. Construit un arbre `TocNode[]` à partir d'une liste plate de titres, gère les clics pour scroll-into-view et le repli des sections.
- `src/lib/components/sidebar/Sidebar.svelte` — orchestre les différents panes (Files, Search, TOC). Active le pane TOC quand l'utilisateur clique sur son icône.

**Services concernés** : aucun service dédié. L'extraction est faite directement dans `editor.ts` et dupliquée dans `TocPane.svelte`.

**Logique d'extraction.** Dans `src/lib/stores/editor.ts` :

```ts
const HEADING_REGEX = /^(#{1,6})\s+(.+)/;

function extractHeadings(content: string): TocEntry[] {
  const headings: TocEntry[] = [];
  const lines = content.split('\n');
  let pos = 0;
  for (const line of lines) {
    const match = line.match(HEADING_REGEX);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/\s*#+\s*$/, '').trim(),
        pos,
      });
    }
    pos += line.length + 1;
  }
  return headings;
}
```

Chaque ligne est testée. Le nombre de `#` donne le niveau, le reste donne le texte (avec suppression d'éventuels `#` de fermeture style ATX). La position en caractères dans le document est conservée pour usage futur.

**Debounce.** Dans `editor.updateContent()`, après avoir mis à jour le contenu, un `setTimeout` de 300 ms déclenche `extractHeadings()`. Si tu tapes vite, les itérations intermédiaires sont annulées.

**Backend Rust impliqué** : aucun. Tout est calculé côté frontend. Une piste de fix (cf. ci-dessous) consisterait à ajouter une commande IPC `extract_headings(markdown)` qui utiliserait [comrak](../01-decouverte/glossaire.md#comrak) côté Rust pour un parsing AST robuste.

**Stores impactés** :

- `editor.toc` — un `writable<TocEntry[]>`. Mis à jour à chaque débounce d'extraction.
- `editor.activeTab` — quand on change d'onglet, le subscribe dans `TocPane.svelte` re-construit l'arbre depuis le contenu du nouvel onglet.

**Scroll vers un titre.** Implémentation dans `TocPane.scrollToHeading(text)` :

```ts
const editorEl = document.querySelector('[contenteditable="true"]');
const headings = editorEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
for (const h of headings) {
  if (h.textContent?.trim() === text) {
    h.scrollIntoView({ behavior: 'smooth', block: 'center' });
    h.classList.add('toc-highlight');
    setTimeout(() => h.classList.remove('toc-highlight'), 1500);
    return;
  }
}
```

On cherche le premier élément `<h1>`-`<h6>` dans le DOM rendu par Muya dont le `textContent` correspond. **Limitation** : si deux titres ont exactement le même texte, le scroll vise toujours le premier.

## Pièges connus

- **TOC instable / pas toujours fonctionnelle** ⚠️ : l'extraction par regex naïve casse dans plusieurs cas réels. Voir [`problemes-connus.md#table-des-matières-instable--pas-toujours-fonctionnelle`](../06-references/problemes-connus.md#table-des-matières-instable--pas-toujours-fonctionnelle).

  Cas qui produisent des résultats faux ou incomplets :
  - **Lignes commençant par `#` à l'intérieur d'un bloc de code triple-backtick** : un commentaire `# foo` en Python ou un titre de section en Bash sera interprété comme un titre Markdown.
  - **Frontmatter YAML** : un commentaire `# this is YAML` au début du document est listé dans la TOC.
  - **HTML brut** : un `<h2>...</h2>` n'est pas détecté (la regex ne traite que le format ATX).
  - **Lignes indentées** : un `   # Titre` (avec espaces avant) n'est pas reconnu — c'est conforme à la spec CommonMark, mais peut surprendre.

  Une piste de fix mentionnée dans l'audit (`06-references/audit.md`) : exposer une commande IPC `extract_headings(markdown)` côté Rust qui utiliserait `comrak` pour un parsing AST réel. Coût : faible, gain : extraction stable et fidèle au rendu réel.

- **Doublon d'extraction** : la fonction `extractHeadings()` existe à deux endroits — dans `editor.ts` et dans `TocPane.svelte` (`buildTocTree`). C'est une duplication mineure, à factoriser.

- **Désynchro pendant la frappe** : pendant la fenêtre de 300 ms du debounce, la TOC affichée ne reflète pas les frappes les plus récentes. C'est volontaire (perf), mais peut perturber sur les frappes très rapides.

- **Scroll vers un doublon** : titres avec un texte identique → seul le premier est atteignable.

## Pour aller plus loin

- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — où vit le store `editor.toc` dans la couche frontend.
- [`edition-wysiwyg.md`](edition-wysiwyg.md) — comment les modifications de contenu déclenchent la régénération.
- [`recherche.md`](recherche.md) — fonctionnalité voisine dans la sidebar, qui utilise un mécanisme similaire de scroll-into-view.
- [`06-references/audit.md`](../06-references/audit.md) — détail de la dette TOC et des pistes d'évolution.
