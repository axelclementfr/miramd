# Problèmes connus

> Inventaire des bugs et limites identifiés dans MiraMD au 2026-04-29, après analyse profonde du code.
> Dernière mise à jour : 2026-05-08. Cinq entrées ajoutées (TOC clic, zoom système, mode Lecture, typewriter, code blocks bash) ; deux résolues le même jour : "Slider de zoom système" (refonte du zoom) et "Mode Lecture / lock" (classe CSS `.muya-readonly`).
> Pour chaque entrée : symptôme observable, où ça vit dans le code, hypothèse de cause, piste de fix, et statut.
> À tenir à jour : marquer comme **résolu** quand un fix est mergé.

---

## Bugs visibles côté utilisateur

### Ctrl+Z se comporte mal au changement d'onglet

- **Symptôme** : annuler après un changement d'onglet ramène parfois à un état inattendu, ou ne fait rien, ou semble sauter des étapes.
- **Périmètre** :
  - `src/lib/components/editor/MuyaPane.svelte` (intercept clavier capture phase Ctrl+Z/Y, sauvegarde/restauration de l'historique au changement d'onglet)
  - `src/lib/services/historyCache.ts` (cache `Map<tabId, history>`)
  - `src/lib/services/muya.ts` (`getHistory()` / `setHistory()` / `clearHistory()`)
  - Muya internal `history.js` (vendored, format opaque)
- **Cause probable** : trois mécanismes empilés qui se marchent dessus.
  1. Muya gère son propre historique en interne.
  2. `historyCache` snapshot/restore l'historique Muya à chaque tab switch.
  3. `MuyaPane` intercepte Ctrl+Z/Y en **capture phase** parce que WebKitGTK ne supporte pas correctement le contenteditable natif.
  Si le snapshot d'historique est pris au mauvais moment (avant que Muya ait fini de traiter une frappe), ou si le format d'historique Muya change subtilement, l'état restauré n'est plus cohérent. L'intercept en capture phase bypasse aussi l'état natif du navigateur.
- **Piste de fix** :
  - Ajouter un test d'intégration "tape, switch, switch back, undo" et observer les divergences.
  - Tracer chaque appel à `getHistory()` / `setHistory()` avec le `tabId` et la taille de l'historique.
  - Vérifier l'ordre des opérations dans `MuyaPane.onMount` et `subscribe(activeTabId)` : le snapshot doit avoir lieu **avant** `setMarkdown` du nouvel onglet.
- **Statut** : ouvert.

---

### Sauvegarde silencieuse : pas de feedback en cas d'échec

- **Symptôme** : occasionnellement, un fichier semble sauvegardé (pas d'astérisque "modifié") mais la modification n'est pas persistée sur disque.
- **Périmètre** :
  - `src/lib/services/autoSave.ts` (boucle d'auto-sauvegarde, polling 2 s)
  - `src/lib/services/fileOperations.ts` (`saveCurrentFile`)
  - `src-tauri/src/filesystem.rs` (`write_file`)
- **Cause probable** : l'écriture côté frontend est un **fire-and-forget** vers la commande IPC `write_file`. Si Rust retourne une erreur (permissions, disque plein, fichier verrouillé, path traversal détecté), le `.catch()` côté JS log dans la console mais ne notifie pas l'utilisateur. Le store `editor` marque l'onglet comme "saved" de manière optimiste avant d'avoir confirmation backend.
- **Piste de fix** :
  - Attendre la résolution de la promise IPC avant de marquer l'onglet "saved".
  - Afficher un toast d'erreur via `toastStore` en cas d'échec (cf. `src/lib/stores/toast.ts`, déjà disponible).
  - Ajouter un retry exponentiel optionnel pour les erreurs transitoires (disque plein, fichier momentanément verrouillé).
  - Vérifier l'idempotence : ne pas réécrire si `content === savedContent`.
- **Statut** : ouvert.

---

### Table des matières instable / pas toujours fonctionnelle

- **Symptôme** :
  - La TOC affichée dans la sidebar peut sauter des titres, en lister des inexistants, ou ne pas se synchroniser avec le scroll de l'éditeur.
  - **Cliquer sur un élément de la TOC ne fait pas naviguer l'éditeur** vers le titre correspondant (le scroll Muya ne bouge pas, ou bouge vers une mauvaise position).
- **Périmètre** :
  - `src/lib/stores/editor.ts` (extraction TOC via regex sur le markdown brut, debounce 300 ms)
  - `src/lib/components/sidebar/TocPane.svelte` (affichage et handler de clic)
  - Lien TOC ↔ scroll Muya
- **Cause probable** : l'extraction utilise une regex naïve `^(#{1,6})\s+(.+)$` sur le markdown brut. Cas qui cassent :
  - Lignes commençant par `#` à l'intérieur d'un bloc de code triple-backtick.
  - Frontmatter YAML qui contient des `#` en commentaires.
  - HTML brut avec des heading comme `<h2>...</h2>`.
  - Texte indenté avec espaces avant le `#`.
  De plus, le debounce 300 ms peut produire des intermédiaires incohérents si l'utilisateur tape vite.
  Pour le clic sans navigation : `TocPane.svelte` ne semble pas appeler une API Muya (`scrollIntoView` sur l'ancre, ou `muya.jumpToBlock`) — ou alors elle appelle une ancre inexistante car la regex liste un titre que Muya n'a pas.
- **Piste de fix** :
  - Remplacer la regex par un parsing AST. Deux options :
    a) Réutiliser `comrak` côté backend via une nouvelle commande IPC `extract_headings(markdown) -> Vec<{level, text, line}>`.
    b) Côté frontend, utiliser une lib JS dédiée (`unified` + `remark-parse`) — coût bundle.
  - Synchroniser la position du clic TOC avec le scroll Muya en utilisant les ancres natives Muya. Inspecter dans `static/muya/` les méthodes `scrollIntoView` / `getAnchor` exposées par l'instance Muya, et appeler depuis `TocPane.svelte` plutôt qu'un scroll manuel via offset DOM.
  - Ajouter un test d'intégration : "ouvrir un fichier avec 5 H2, cliquer sur le 4ème dans la TOC, vérifier que le scroll de l'éditeur se positionne sur ce H2".
- **Statut** : ouvert.

---

### Bugs sur les tableaux

- **Symptôme** : insertion/suppression de lignes ou colonnes parfois bloquée, redimensionnement qui saute, navigation au clavier qui se comporte mal.
- **Périmètre** :
  - `src/lib/muya/lib/contentState/tableBlockCtrl.js` (vendored, contrôleur tableau)
  - `src/lib/muya/lib/contentState/tableSelectCellsCtrl.js`
  - `src/lib/muya/lib/contentState/tableDragBarCtrl.js`
- **Cause probable** : ces bugs sont **dans Muya lui-même** (vendored), pas dans la couche MiraMD. MarkText avait probablement les mêmes ou des similaires. Le format de tableau Markdown étant verbeux (alignement, échappement de `|`), le contrôleur de tableau Muya est complexe et fragile.
- **Piste de fix** :
  - Court terme : reproduire un cas minimal et vérifier si le bug existe déjà dans MarkText. Si oui, il vient de Muya — pas notre couche.
  - Moyen terme : surveiller le repo Muya upstream (`marktext/muya`) et rapatrier les fixes.
  - Long terme : remplacer Muya à terme (cf. ADR `04-muya-conserve.md`).
- **Statut** : ouvert, dépend de Muya.

---

### Désynchronisation source ↔ WYSIWYG en mode split

- **Symptôme** : en mode split (source + preview), une frappe rapide dans le textarea source n'est pas immédiatement reflétée dans le pane Muya, ou inversement.
- **Périmètre** :
  - `src/lib/components/editor/SourcePane.svelte` (textarea non-contrôlé, debounce 400 ms vers Muya)
  - `src/lib/services/editorModes.ts` (sourceContent store)
- **Cause probable** : `SourcePane` est un textarea non-contrôlé pour permettre une frappe fluide. La synchronisation vers Muya passe par un debounce 400 ms. Si l'utilisateur tape, switch vers le pane Muya, et tape, les deux contenus peuvent diverger pendant la fenêtre de debounce.
- **Piste de fix** :
  - Ajouter une garde "écrivain actif" : si focus est sur SourcePane, Muya ne reçoit la sync qu'après blur.
  - Réduire le debounce ou passer à throttle.
  - Test d'intégration pour ce scénario.
- **Statut** : ouvert.

---

### Code blocks bash : police et style trop accentués vs autres langages

- **Symptôme** : les blocs de code identifiés comme `bash` (ou `sh`, `shell`) sont rendus avec une police différente et des effets visuels (gras, couleurs très saturées, possibles backgrounds spécifiques) plus marqués que les autres blocs de code (`js`, `python`, etc.). Visuellement parasite et incohérent. L'objectif : **garder une coloration spécifique au bash** (ex. couleur dédiée pour les commandes/options) **mais aligner la police, la taille et l'intensité** sur les autres blocs.
- **Périmètre** :
  - `src/lib/muya/dist/index.min.css` (CSS bundlé Muya — contient les classes Prism `.token.*` et les sélecteurs spécifiques `language-bash`)
  - `src/lib/muya/themes/default.css` (overrides de thème)
  - `src/lib/muya/lib/assets/styles/index.css` (source non minifiée — éditable plus facilement)
  - Plus généralement les sélecteurs Prism `code[class*="language-bash"]` ou `.token.builtin` propres au tokenizer bash
- **Cause probable** : le tokenizer Prism pour bash classe certains tokens (`function`, `builtin`, `keyword`) avec des styles agressifs (`font-weight: bold`, couleurs très saturées) qui ne sont pas neutralisés par le thème par défaut de Muya. Pour les autres langages, soit le tokenizer Prism produit moins de tokens "agressifs", soit le thème par défaut a déjà des règles qui les calment — mais bash passe au travers.
- **Piste de fix** :
  - Inspecter dans le navigateur le DOM d'un bloc `bash` vs un bloc `js` : identifier les classes `.token.*` spécifiques au bash et les règles CSS qui les ciblent.
  - Ajouter dans `src/lib/styles/themes.css` ou un fichier dédié des overrides : `code[class*="language-bash"] .token { font-weight: normal; font-family: var(--font-monospace); font-size: inherit; }`, puis ne re-définir que les couleurs voulues.
  - Vérifier que le fix n'altère pas les autres langages.
  - Documenter le choix dans `docs/05-fonctionnalites/themes.md` ou équivalent.
- **Statut** : ouvert, priorité basse (cosmétique).

---

## Bugs invisibles / silencieux

### Erreurs préférences silencieuses

- **Symptôme** : aucun, c'est ça le problème. Un changement de préférence peut échouer côté backend sans que l'utilisateur s'en aperçoive — il revient à zéro au prochain redémarrage.
- **Périmètre** : `src/lib/stores/preferences.ts` (`patch()` fire-and-forget)
- **Cause probable** : `invoke('save_preferences', ...).catch(...)` log seulement, ne notifie rien.
- **Piste de fix** : toast d'erreur explicite, ou banner persistant si la sauvegarde échoue plusieurs fois.
- **Statut** : ouvert.

---

### Backup `.bak` silencieux

- **Symptôme** : si le `.bak` ne peut pas être écrit (disque plein, permissions), l'écriture principale tente quand même, et en cas de corruption il n'y a plus de backup.
- **Périmètre** : `src-tauri/src/preferences.rs:242` (warning loggué, ignoré)
- **Cause probable** : choix volontaire pour ne pas bloquer l'écriture des préférences. Mais l'utilisateur ne sait pas qu'il vient de perdre son backup.
- **Piste de fix** : émettre un événement Tauri vers le frontend pour afficher un toast warning. Ne pas bloquer l'écriture.
- **Statut** : ouvert, priorité basse.

---

### Fallback `/tmp` pour les préférences

- **Symptôme** : si la config dir XDG est inaccessible, les préférences sont sauvées dans `/tmp/miramd/preferences.json`, qui peut être nettoyé au reboot.
- **Périmètre** : `src-tauri/src/preferences.rs:202-204` (cascade de fallbacks)
- **Cause probable** : choix défensif pour éviter un crash. Mais l'utilisateur perd ses prefs sans le savoir.
- **Piste de fix** : afficher un toast au boot si on a fallback dans `/tmp`.
- **Statut** : ouvert, priorité basse.

---

## Bugs structurels / dette

### Pas de mode debug global

- **Symptôme** : pour comprendre un bug en runtime, il faut sprinkler des `console.log` dans plusieurs fichiers de services.
- **Périmètre** : tout le frontend.
- **Cause probable** : pas de système de logging centralisé côté JS. `debug_log` IPC existe mais est noop en release.
- **Piste de fix** : créer un store `debugFlags` (writable, default toutes à false) avec des flags par sujet (`autoSave`, `muya`, `tabSwitch`, `prefs`, `toc`). Chaque service consulte le flag pour décider d'écrire dans la console. Un raccourci dev (Ctrl+Shift+D ?) ouvre un panneau pour cocher.
- **Statut** : ouvert. **Recommandé en priorité** car débloque l'analyse de tous les autres bugs.

---

### Migration de schéma préférences non implémentée

- **Symptôme** : aucun pour l'instant, mais à la première migration breaking, les utilisateurs perdront leurs settings.
- **Périmètre** : `src-tauri/src/preferences.rs` (`prefs_version: u32` déclaré, jamais lu).
- **Piste de fix** : implémenter `migrate_preferences(prefs)` qui inspecte `prefs_version` et applique des transformations idempotentes.
- **Statut** : ouvert, à traiter avant le prochain changement breaking de schéma.

---

### Validation CLI dupliquée

- **Symptôme** : aucun, juste de la dette.
- **Périmètre** : `src-tauri/src/lib.rs:40` et `lib.rs:64` — `is_markdown_file()` appelé deux fois dans deux contextes (setup + single-instance event handler).
- **Piste de fix** : extraire un helper `validate_and_register_cli_file(path, state)`.
- **Statut** : ouvert, priorité basse.

---

### Pas de timeout IPC

- **Symptôme** : si une commande IPC se fige (ex: parse markdown sur un fichier de 9.99 MB plein de tableaux imbriqués), l'UI se fige sans feedback.
- **Périmètre** : toutes les commandes Tauri.
- **Piste de fix** : wrapper `invokeWithTimeout(cmd, args, ms)` côté frontend qui rejette après N secondes et affiche un toast.
- **Statut** : ouvert, priorité moyenne.

---

## Limites connues (par design)

Ces points ne sont pas des bugs à fixer mais des choix documentés.

- **`unsafe-eval` dans la CSP** : nécessaire pour Muya (coloration syntaxique). Sera retiré quand Muya sortira (cf. ADR `04-muya-conserve.md`).
- **I/O Rust synchrone** : `read_file`, `write_file`, `list_directory_entries` sont synchrones. Acceptable pour des fichiers usuels, peut bloquer sur des cas extrêmes (fichier 50 MB, dossier 10 000 entrées).
- **Pas de virtualisation** dans `TabBar` et `FileTreePane` : tous les éléments rendus dans le DOM. Pas de problème pour l'usage courant.
- **Muya vendored sans sync upstream** : les fixes du repo MarkText/Muya doivent être rapatriés manuellement.

---

## Résolus

### Mode Typewriter : le centrage ne suivait pas après un saut de ligne

- **Résolu le** : 2026-05-08.
- **Symptôme initial** : en mode typewriter, appuyer sur Entrée ne déclenchait pas le re-centrage du curseur. Le curseur descendait visuellement vers le bas, jusqu'à ce que l'utilisateur tape un caractère qui re-déclenchait le scroll.
- **Cause** : `range.getBoundingClientRect()` sur une range collapsée dans un nouveau paragraphe vide (créé par Enter) retourne un rect tout-zéro (`top: 0, height: 0, …`). Le scroller avait un check précoce `if (rect.top === 0) return` qui skippait silencieusement le re-centrage. Sur un caractère tapé, le rect était valide → ça marchait. Différence subtile entre changement de sélection avec contenu vs sans.
- **Fix** : extraction d'une fonction pure `computeTypewriterOffset(range, scrollTarget)` dans `src/lib/services/typewriterScroller.ts`, avec fallback sur `parentElement.getBoundingClientRect()` quand le rect de la range est zéroé. Pattern aligné sur la mesure interne de Muya (`src/lib/muya/lib/selection/index.js:598` mesure aussi `paragraph.getBoundingClientRect()`). 6 nouveaux cas dans `tests/services/typewriterScroller.test.ts` couvrant l'empty-paragraph fallback, le top=0 légitime au début du document, et le edge case où aucun rect n'est mesurable.

---

### Mode Lecture (lock) : sélection affichait la toolbar Muya, et les marqueurs source restaient visibles

- **Résolu le** : 2026-05-08.
- **Symptôme initial** : `preferences.readOnly = true` n'avait aucun effet utile au-delà de bloquer la frappe. La toolbar flottante Muya (`FormatPicker`) apparaissait toujours à la sélection souris, et les marqueurs `**` / ` `` ` / `#` restaient visibles dès qu'un curseur passait à côté.
- **Cause** : Muya n'a pas de mode `readOnly`/preview natif. `contenteditable=false` + `instance.blur(true, true)` ne désactivent ni les plugins UI qui réagissent à `selectionChange` (`keyboard.js:286`, `clickCtrl.js:162`), ni la logique `getClassName` qui re-affiche les markers en `AG_GRAY` quand le curseur est en conflit avec un span `.ag-remove`.
- **Fix** : approche CSS-driven pilotée par une classe `.muya-readonly` posée sur `<body>` depuis `src/lib/services/editorModes.ts` à chaque changement de `preferences.readOnly`. Deux règles dans `src/lib/styles/editor.css` :
  - `body.muya-readonly .ag-float-wrapper { display: none !important; }` — couvre tous les floats Muya (FormatPicker, LinkTools, ImageToolbar, FrontMenu…) qui héritent de `.ag-float-wrapper` via `baseFloat/index.js`.
  - `body.muya-readonly .ag-remove { display: none !important; }` — force tous les markers à rester invisibles indépendamment du curseur.
  Pattern aligné sur l'existant `hide-scrollbar`. Test ajouté dans `tests/services/editorModes.test.ts`.

---

### Slider de zoom système : pas de "preview puis commit" comme les autres réglages

- **Résolu le** : 2026-05-08 (refonte complète du zoom, voir [`docs/superpowers/specs/2026-05-08-zoom-redesign-design.md`](../superpowers/specs/2026-05-08-zoom-redesign-design.md) et [`docs/05-fonctionnalites/zoom.md`](../05-fonctionnalites/zoom.md)).
- **Symptôme initial** : le slider de zoom dans Settings appliquait/persistait la valeur dès le moindre mouvement (`oninput`), alors que les autres sliders (font size, line height, line width) commitaient au relâchement (`onchange`). Pattern incohérent.
- **Cause** : `bind:value={prefs.zoom} oninput={applyPrefs}` dans `src/lib/components/settings/GeneralSection.svelte:66`, alors que les autres sliders utilisent `onchange`.
- **Fix** : `oninput` → `onchange` sur le slider zoom. La refonte plus large a aussi remplacé le mécanisme sous-jacent : le zoom n'est plus un multiplicateur de `fontSize` appliqué via une CSS variable, mais le vrai zoom WebKit natif appelé via une nouvelle commande Tauri `set_app_zoom`. Voir la spec et la doc liées pour le détail.

---

## Comment ajouter une entrée

Format à respecter :

```markdown
### Titre court et descriptif

- **Symptôme** : ce que voit l'utilisateur
- **Périmètre** : fichiers concernés (chemins absolus depuis la racine projet)
- **Cause probable** : hypothèse étayée par l'analyse
- **Piste de fix** : direction suggérée, sans engagement
- **Statut** : ouvert / en cours / résolu (avec date)
```

Quand un bug est résolu, **ne pas supprimer l'entrée** — la déplacer en bas dans une section "Résolus" avec la date et le commit hash. C'est précieux pour comprendre l'historique des fragilités du projet.
