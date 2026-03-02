# Problèmes connus

> Inventaire des bugs et limites identifiés dans MiraMD au 2026-04-29, après analyse profonde du code.
> Dernière mise à jour : 2026-05-08 (5 entrées ajoutées : TOC clic, zoom système, mode Lecture, typewriter, code blocks bash. Le bug "Slider de zoom système" a été résolu le même jour par la refonte du zoom — voir section "Résolus").
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

### Mode Lecture (lock) : sélection affiche la toolbar Muya, et marqueurs source visibles

- **Symptôme** : quand `preferences.readOnly = true` (verrou activé via `LockToggle`) :
  - Sélectionner du texte fait apparaître la toolbar flottante Muya (formatting tools : gras, italique, lien…), alors qu'en lecture seule aucune action d'édition ne devrait être possible — la toolbar devrait être masquée.
  - Les marqueurs de la vue "Source" restent visibles dans le rendu (astérisques `**` autour du gras, backticks autour de l'inline code, `~~` autour du barré, etc.). Cela parasite la lecture en mode lock, qui devrait afficher un rendu propre style "preview".
- **Périmètre** :
  - `src/lib/components/editor/LockToggle.svelte` (toggle `readOnly`)
  - `src/lib/services/muya.ts` (configuration Muya, options `mutedSelection` / `hideQuickInsertHint` / `bulletListMarker` non exposées en runtime)
  - `src/lib/components/editor/MuyaPane.svelte` (où `readOnly` devrait être propagé à l'instance Muya)
  - `static/muya/` — les options `setOptions({ readOnly })` ou équivalent ne semblent pas câblées
- **Cause probable** : `LockToggle` ne fait que basculer la préférence ; aucun composant ne consomme `preferences.readOnly` pour configurer Muya en mode lecture pure. Muya supporte un mode "preview" (rendu sans marqueurs) via son option de cursor ou via une API `setReadOnly`/`togglePreview`, mais cette API n'est pas appelée. Résultat : le DOM reste éditable, la toolbar de sélection reste active, et les marqueurs (astérisques, etc.) restent affichés.
- **Piste de fix** :
  - Identifier dans `static/muya/` l'option d'instance qui désactive l'édition et passe en preview (probablement `muya.setOptions({ readOnly: true })` ou un mode dédié — à vérifier dans le source vendored).
  - Dans `MuyaPane.svelte`, souscrire à `preferences.readOnly` et appeler l'API correspondante.
  - Si Muya n'expose pas un vrai mode preview : appliquer en CSS `pointer-events: none` sur l'éditeur + masquer `.ag-tool` (la toolbar flottante) en mode lock, et utiliser une classe `.muya-readonly` qui cache les `.ag-gray` / marqueurs source via les sélecteurs Prism/Muya.
  - Test manuel : activer le lock, sélectionner du texte → la toolbar ne doit pas apparaître ; vérifier qu'aucun astérisque ne soit visible autour des spans `<strong>`.
- **Statut** : ouvert, priorité haute (le mode lock ne remplit pas son rôle aujourd'hui).

---

### Mode Typewriter : le centrage ne suit pas après un saut de ligne

- **Symptôme** : en mode typewriter (où la ligne courante doit rester centrée verticalement), appuyer sur Entrée pour créer une nouvelle ligne ne déclenche pas le re-centrage. Le curseur descend visuellement vers le bas de l'écran au lieu de rester au milieu, jusqu'à ce qu'on tape un caractère ou qu'on bouge le curseur autrement.
- **Périmètre** :
  - `src/lib/services/typewriterScroller.ts` (logique de centrage)
  - `src/lib/components/editor/MuyaPane.svelte` (intégration des listeners Muya)
  - Événements Muya écoutés pour déclencher le re-centrage (`selectionChange`, `contentChange` …)
- **Cause probable** : le scroller écoute probablement uniquement les événements de **changement de sélection** ou de **frappe de caractère**, mais pas l'insertion d'un block-break (Enter qui crée un nouveau paragraphe). Dans Muya, Enter crée un nouveau bloc et la sélection se déplace, mais l'événement émis peut être un `block-create` plutôt qu'un `selectionChange`, ou bien le `selectionChange` est émis avant que le DOM du nouveau bloc soit positionné — donc le calcul du `top` cible est fait sur l'ancienne géométrie.
- **Piste de fix** :
  - Logger dans `typewriterScroller.ts` chaque événement reçu et la position calculée, reproduire sur 5 sauts de ligne et observer la divergence.
  - S'abonner aussi à un événement de type `content-change` ou utiliser un `MutationObserver` sur le container Muya pour déclencher le re-centrage après un layout commit.
  - Wrapper le calcul de position dans un `requestAnimationFrame` (voire double rAF) pour s'assurer que le DOM est à jour avant de mesurer.
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
