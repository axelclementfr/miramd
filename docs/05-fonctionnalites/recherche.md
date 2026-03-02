# Recherche

Recherche textuelle à l'intérieur du document courant. Les résultats sont listés dans la sidebar, et un clic fait défiler l'éditeur jusqu'au passage trouvé.

## Vue utilisateur

**Ouvrir le pane de recherche.**

- Cliquer sur l'icône loupe dans la barre d'icônes verticale de la sidebar.
- (Pas de raccourci `Ctrl+F` natif global vérifié dans `services/shortcuts.ts` — à vérifier.)

**Saisir une recherche.**

- Une zone de texte en haut du pane reçoit la requête.
- Trois options de filtrage, activables/désactivables individuellement :
  - **Casse** (icône Aa) — distinguer majuscules et minuscules.
  - **Mot entier** (icône avec barres) — seuls les mots qui matchent en entier (frontière de mot) comptent.
  - **Regex** (icône `.*`) — interpréter la requête comme une expression régulière JavaScript. Si la regex est invalide, la liste de résultats est vidée silencieusement.

**Lire les résultats.**

- En dessous, le nombre de résultats est affiché ("3 matches" ou "1 match" selon la pluralité, traduit dans la langue active — cf. [`i18n.md`](i18n.md)).
- Chaque résultat affiche le numéro de ligne (`L42`) et un extrait (les 100 premiers caractères de la ligne).
- Cliquer sur un résultat fait défiler l'éditeur jusqu'au bloc correspondant et applique brièvement un effet de surbrillance.
- `Entrée` dans le champ de saisie navigue au résultat suivant, en boucle.
- `Échap` vide la requête et la liste de résultats.

**Périmètre.**

- La recherche concerne **uniquement le document actuellement actif**. Pas de recherche multi-fichier, pas de recherche dans un dossier ouvert.
- Si aucun document n'est ouvert, la recherche n'affiche rien.

## Implémentation

C'est une recherche **côté frontend, sur le contenu de l'onglet courant**, ligne par ligne, avec une regex JavaScript construite à la volée.

**Composants Svelte concernés** :

- `src/lib/components/sidebar/SearchPane.svelte` — tout est ici. Champ de saisie, options, exécution de la recherche, affichage des résultats, scroll vers un résultat.
- `src/lib/components/sidebar/Sidebar.svelte` — orchestre les onglets de la sidebar (Files, Search, TOC).

**Services concernés** : aucun service dédié. La logique est entièrement dans le composant `SearchPane`.

**Logique de recherche.** Dans `runSearch()` :

```ts
let flags = 'g';
if (!caseSensitive) flags += 'i';
let src = useRegex
  ? searchQuery
  : searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');  // escape regex
if (wholeWord) src = `\\b${src}\\b`;
const pattern = new RegExp(src, flags);

const results = [];
const lines = currentContent.split('\n');
lines.forEach((line, i) => {
  pattern.lastIndex = 0;
  if (pattern.test(line)) {
    results.push({ line: i + 1, text: line.trim().substring(0, 100) });
  }
});
```

Pour chaque ligne du document, on teste la regex. Si elle matche, on garde le numéro de ligne (1-indexé) et un extrait tronqué. Pas de surlignage des matches dans le rendu de l'éditeur — seulement la liste dans la sidebar et un effet de surbrillance temporaire au clic.

**Scroll vers un résultat.** `scrollToLine(lineNum)` :

```ts
const editorEl = document.querySelector('[contenteditable="true"]');
const blocks = editorEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, table, hr');
const target = blocks[Math.min(lineNum - 1, blocks.length - 1)];
target.scrollIntoView({ behavior: 'smooth', block: 'center' });
target.classList.add('toc-highlight');
setTimeout(() => target.classList.remove('toc-highlight'), 1200);
```

On itère les blocs visibles dans Muya et on prend le N-ième (clamp à la longueur). C'est imprécis : un même bloc peut compter plusieurs lignes Markdown, donc le numéro de ligne du résultat ne correspond pas toujours exactement à un bloc DOM.

**Backend Rust impliqué** : aucun. Tout se passe en JavaScript dans la WebView.

**Stores impactés** :

- `editor.activeTab` — la recherche subscribe pour relire le contenu quand l'onglet change. Si une recherche est active, elle est relancée automatiquement.

## Pièges connus

Aucun piège connu actuellement. La recherche est un mécanisme simple et autonome qui n'a pas de bug ouvert recensé dans `06-references/problemes-connus.md`. Quelques limites par design :

- **Pas de recherche multi-fichier**. Pour rechercher dans plusieurs fichiers ouverts, tu dois changer d'onglet manuellement et relancer la recherche.
- **Imprécision du `scrollToLine`** : la correspondance ligne-Markdown ↔ bloc-DOM est approximative parce que Muya regroupe plusieurs lignes dans un même élément (par exemple un paragraphe multi-lignes, ou un bloc de code). Le scroll vise le bon voisinage, pas toujours la ligne exacte.
- **Pas de surbrillance dans le rendu** : les matches ne sont pas highlightés dans l'éditeur lui-même, seulement listés dans la sidebar.
- **Pas de remplacement (search & replace)** : seule la recherche est implémentée. Pour remplacer, il faut éditer manuellement.
- **Regex silencieuse** : si l'utilisateur saisit une regex invalide en mode regex (par exemple `\\` non échappé), la liste de résultats devient vide sans message d'erreur. C'est tolérable mais un peu sec.

## Pour aller plus loin

- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — où le pane Search se situe dans l'orchestration de la sidebar.
- [`table-des-matieres.md`](table-des-matieres.md) — fonctionnalité voisine, même mécanisme de scroll-into-view via la sidebar.
- [`edition-wysiwyg.md`](edition-wysiwyg.md) — la zone d'édition dans laquelle on cherche.
