# Édition WYSIWYG

L'édition [WYSIWYG](../01-decouverte/glossaire.md#wysiwyg) est le cœur de MiraMD : tu tapes du [Markdown](../01-decouverte/glossaire.md#markdown), et le rendu visuel apparaît en temps réel pendant que tu écris. Pas de panneau "preview" séparé, pas de bascule manuelle — c'est une seule expérience continue.

## Vue utilisateur

Quand tu tapes dans MiraMD, le texte est mis en forme **au moment même** où tu écris la syntaxe Markdown.

**Reconnaissance temps réel.** Voici les transformations principales que tu vas observer :

- `# Titre` puis espace → la ligne devient un titre de niveau 1, avec la taille et le style associés.
- `## Sous-titre`, `### `, jusqu'à `######` → titres de niveau 2 à 6.
- `**texte**` → le texte entre les deux paires d'astérisques devient gras.
- `*texte*` ou `_texte_` → italique.
- `` `code` `` → texte affiché en police à chasse fixe (monospace).
- `- item` ou `* item` → puce de liste à puces.
- `1. item` → puce de liste numérotée.
- `> citation` → bloc de citation.
- ` ``` ` (trois backticks) puis Entrée → bloc de code.
- `---` sur une ligne seule → trait horizontal.
- `[texte](url)` → lien cliquable.

Quand le curseur quitte un élément, les marqueurs Markdown deviennent visuellement discrets (grisés ou cachés). Quand tu repasses sur l'élément, ils réapparaissent pour que tu puisses les éditer.

**Auto-pairing.** MiraMD ferme automatiquement certaines paires pour t'éviter de taper deux fois :

- Tape `*` à gauche d'une sélection → MiraMD entoure la sélection avec `*...*`.
- Tape `[` → `[]` est inséré, le curseur entre les crochets.
- Tape `(`, `{`, `"`, `'`, `` ` `` → même principe.
- Cette assistance est **désactivable** dans les préférences (cf. [`preferences.md`](preferences.md), section éditeur).

**Toolbar flottant.** Quand tu sélectionnes du texte, une petite barre apparaît au-dessus de la sélection avec les boutons Gras / Italique / Souligné / Barré / Surligné / Code inline / Lien. Cliquer applique la mise en forme correspondante. Si tu n'aimes pas, le raccourci clavier (Ctrl+B pour gras, etc.) fait la même chose sans toolbar.

**Icône de type de bloc.** Sur la marge gauche d'un bloc actif (paragraphe, titre, liste...), une petite icône apparaît qui indique le type du bloc : `P` pour paragraphe, `H1`-`H6` pour les titres, `UL` pour liste à puces, `OL` pour liste numérotée, `Quote` pour citation, `Code` pour bloc de code. Cliquer dessus ouvre un menu pour transformer le bloc.

**Coloration syntaxique des blocs de code.** Dès que tu commences un bloc de code et précise un langage (`` ```javascript ``, `` ```rust ``, etc.), le contenu du bloc est coloré selon les conventions du langage. La coloration est faite par [Prism](https://prismjs.com), embarqué dans Muya.

## Implémentation

Toute l'édition WYSIWYG est gérée par **[Muya](../01-decouverte/glossaire.md#muya)**, le moteur d'édition vendored dans `src/lib/muya/`. MiraMD ne réimplémente rien de cette logique — il monte Muya, lui donne le contenu initial, et écoute ses événements.

**Composants Svelte concernés** :

- `src/lib/components/editor/MuyaPane.svelte` — monte Muya à l'intérieur d'un `<div>`, gère le cycle de vie (mount / destroy), et intercepte certains raccourcis clavier (cf. [`onglets-et-historique.md`](onglets-et-historique.md) pour le détail). C'est le seul composant qui touche directement à l'élément DOM contenant Muya.
- `src/lib/components/editor/EditorContainer.svelte` — orchestre le pane WYSIWYG et le pane source (en mode [split](modes-affichage.md)).
- `src/lib/components/editor/SourcePane.svelte` — le textarea brut utilisé en mode source. Pas concerné par l'édition WYSIWYG, mais peut afficher le même contenu en parallèle.

**Services concernés** :

- `src/lib/services/muya.ts` — la **passerelle unique** vers Muya. Singleton, expose `init()`, `getMarkdown()`, `setMarkdown()`, `undo()`, `redo()`, `setOptions()`, `applyPreferences()`, etc. Aucun autre fichier ne devrait toucher Muya directement.
- `src/lib/services/lineNumbers.ts` — gère les numéros de ligne dans les blocs de code (option de préférence).
- `src/lib/services/zoom.ts` — gère le zoom global (Ctrl+plus / Ctrl+moins / Ctrl+0). Ajuste la taille de police via `MuyaService.setFont()`.

**Backend Rust impliqué** : aucun. L'édition se fait entièrement côté frontend, dans la [WebView](../01-decouverte/glossaire.md#webview), à l'intérieur de Muya. Le backend Rust n'intervient que pour lire/écrire les fichiers (cf. [`gestion-fichiers.md`](gestion-fichiers.md)) et pour le parsing offline (rendu de preview ou export — non utilisé pendant l'édition courante).

**Stores impactés** :

- `editor.tabs` — chaque modification dans Muya déclenche un événement `change`. `MuyaPane.svelte` le [débounce](../01-decouverte/glossaire.md#debounce) 100 ms puis met à jour le contenu de l'onglet courant via `editor.updateContent(tabId, markdown)`.
- `editor.stats` — débounce 300 ms, met à jour le compteur de mots / caractères / lignes / paragraphes affiché dans la status bar.
- `editor.toc` — débounce 300 ms, déclenche la regénération de la [table des matières](table-des-matieres.md).
- `muyaInstance` — référence partagée vers l'instance Muya, mise à jour par `MuyaService.init()` / `destroy()`.

**Comment ça s'enchaîne (résumé)** :

1. L'utilisateur tape une touche dans le `<div contenteditable>` rendu par Muya.
2. Muya intercepte la frappe via ses propres event handlers, met à jour son [Virtual DOM](../01-decouverte/glossaire.md#virtual-dom) [Snabbdom](../01-decouverte/glossaire.md#snabbdom), et patch le DOM réel pour faire apparaître le rendu mis en forme.
3. Muya émet un événement `change`. Les callbacks enregistrés par `MuyaService.onChange()` sont notifiés.
4. `MuyaPane.svelte` débounce 100 ms, puis appelle `editor.updateContent(activeTabId, markdown)`.
5. Le store `editor` met à jour l'onglet : si le contenu diffère du contenu sauvegardé sur disque, l'onglet est marqué `isModified = true` (un astérisque apparaît dans la barre d'onglets).
6. La TOC et les stats sont régénérées en parallèle (avec leur propre debounce).

## Pièges connus

- **Bugs sur les tableaux** : insertion / suppression de lignes ou colonnes peut bloquer, redimensionnement qui saute, navigation clavier qui se comporte mal. Ces bugs sont **dans Muya lui-même** (vendored), pas dans la couche MiraMD. Voir [`problemes-connus.md#bugs-sur-les-tableaux`](../06-references/problemes-connus.md#bugs-sur-les-tableaux). MiraMD hérite de la maturité de Muya, donc aussi de ses limites.
- **`unsafe-eval` dans la CSP** : la coloration syntaxique de Prism (et certains diagrammes Mermaid) nécessite `unsafe-eval` dans la [CSP](../01-decouverte/glossaire.md#csp). C'est un choix documenté, à retirer si Muya est un jour remplacé. Voir [`problemes-connus.md`](../06-references/problemes-connus.md) section "Limites connues (par design)".
- **Pas de [TypeScript](../01-decouverte/glossaire.md#typescript) sur Muya** : Muya est du JS legacy vendored. L'API consommée par `MuyaService` est typée à la main dans `src/lib/types/muya-instance.ts`. Si Muya change subtilement, le typage diverge silencieusement.

## Pour aller plus loin

- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — modèle mental des trois couches : UI Svelte, moteur Muya, backend Rust.
- [`04-architecture/integration-muya.md`](../04-architecture/integration-muya.md) — comment Muya est embarqué (script global `window.Muya`), comment `MuyaService` joue le rôle de passerelle.
- [`02-fondamentaux/wysiwyg.md`](../02-fondamentaux/wysiwyg.md) — pourquoi le WYSIWYG plutôt qu'un éditeur source classique.
- [`03-choix-techniques/04-muya-conserve.md`](../03-choix-techniques/04-muya-conserve.md) — la décision de conserver Muya plutôt que d'en réécrire un.
