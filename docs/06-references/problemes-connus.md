# Problèmes connus

> Inventaire des bugs et limites identifiés dans MiraMD au 2026-04-29, après analyse profonde du code.
> Dernière mise à jour : 2026-05-10. Sept entrées résolues (Ctrl+Z faux positif après refonte split, plus la dette structurelle complète : erreurs prefs silencieuses, backup `.bak`, fallback `/tmp`, migration de schéma, validation CLI dupliquée, timeout IPC).
> Pour chaque entrée : symptôme observable, où ça vit dans le code, hypothèse de cause, piste de fix, et statut.
> À tenir à jour : marquer comme **résolu** quand un fix est mergé.

---

## Bugs visibles côté utilisateur

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

### Pas de mode debug global

- **Résolu le** : 2026-05-09, commits `135eab0` à `a2085de` (8 commits).
- **Symptôme initial** : pour comprendre un bug en runtime, il fallait sprinkler des `console.log` à la main, recompiler, reproduire, retirer les logs, recommiter. Pénible et chronophage.
- **Cause** : pas de système de logging centralisé côté JS. Les 47 `console.*` déjà présents dans `src/` étaient soit silencieux (catch blocks `console.debug`), soit bruyants en permanence (`console.warn`/`error`).
- **Fix** : store `debugFlags` typé par sujet (`src/lib/stores/debug.ts`) + helper `dlog(subject, ...args)` (`src/lib/services/debug.ts`) qui gate un `console.log` préfixé `[subject]`. Activation via `localStorage.miramd_debug` au boot ou panneau flottant Ctrl+Shift+D. Badge status bar quand ≥1 sujet actif. 22 `console.info/debug` migrés vers `dlog()`. Spec : [`docs/superpowers/specs/2026-05-09-mode-debug-design.md`](../superpowers/specs/2026-05-09-mode-debug-design.md). Doc utilisateur : [`docs/05-fonctionnalites/mode-debug.md`](../05-fonctionnalites/mode-debug.md).

---

### Sauvegarde silencieuse : pas de feedback en cas d'échec

- **Résolu le** : 2026-05-09 (audit de code, pas de fix nécessaire).
- **Symptôme documenté** : occasionnellement, un fichier semble sauvegardé (pas d'astérisque "modifié") mais la modification n'est pas persistée sur disque. L'utilisateur perd ses modifs sans le savoir.
- **Vérification** : audit des 4 call sites de `write_file` côté frontend :
  - `src/lib/services/fileOperations.ts:51` (`saveCurrentFile` cas fichier existant) : try/catch + `showToast(tr('error_save_file'), 'error')` + skip `markSaved`.
  - `src/lib/services/fileOperations.ts:64` (cas nouveau fichier via dialog) : idem.
  - `src/lib/services/fileOperations.ts:93` (`closeTabWithConfirm` branche "Save & Close") : idem + `return` early pour empêcher la fermeture du tab en cas d'échec.
  - `src/lib/components/TabBar.svelte:48` (close tab via X ou middle-click) : idem.
  - `src/lib/services/autoSave.ts` ne fait pas d'IPC direct — délègue à `saveCurrentFile()`.
  - Côté Rust : `write_file` retourne `Result<(), AppError>`. Toute erreur I/O remonte proprement comme Promise rejection vers JS.
- **Conclusion** : la doc reflétait probablement un état antérieur déjà corrigé. Aucun changement de code requis. Si une régression future réintroduisait le pattern fire-and-forget, le sujet `save` est déjà déclaré dans `DebugSubject` — instrumenter avec `dlog('save', ...)` autour de `invoke('write_file', ...)` permettrait de tracer rapidement.

---

### Désynchronisation source ↔ WYSIWYG en mode split

- **Résolu le** : 2026-05-09 (résolution par design, pas de fix de la race elle-même).
- **Symptôme initial** : en mode split (source + preview), une frappe rapide dans le textarea source pouvait diverger du pane Muya pendant la fenêtre de debounce 400 ms si l'utilisateur tapait dans Muya entre-temps.
- **Cause** : SourcePane (textarea non-contrôlé pour la fluidité de frappe) syncrhonisait vers Muya via debounce. Muya pane était éditable, donc la frappe utilisateur dans Muya pouvait conflicter avec une sync entrante.
- **Fix par design** : on assume désormais que le **mode split est un sous-mode du mode source** — son rôle est d'afficher le rendu en preview pendant qu'on édite la source. Le pane Muya est forcé en `contenteditable="false"` quand `sourceCodeMode && splitView` (déjà fait avant : `MuyaPane.svelte` ligne 131). La nouveauté : l'UI reflète maintenant cette contrainte. Les helpers purs `computeModeToggle` et `canToggleMode` (`src/lib/services/editorModes.ts`) :
  - Grisent le bouton **Split** quand SourceMode est désactivé.
  - Grisent **Focus** et **Typewriter** quand SourceMode est activé.
  - Désactivent automatiquement Split quand on quitte SourceMode (évite l'état incohérent split=true + source=false).
- **Conséquence** : la sync source → preview reste en debounce 400 ms, mais elle est désormais **strictement unidirectionnelle**, donc plus de race possible côté Muya.
- **Tests** : 17 nouveaux tests dans `tests/services/editorModes.test.ts` couvrant `computeModeToggle`, `canToggleMode`, et l'intégration avec le store via `editorModes.toggle()`.

---

### Table des matières : extraction naïve + clic sans navigation

- **Résolu le** : 2026-05-09, commits `49683de` (extracteur pur + tests) et `75426c7` (fix click + dédup).
- **Symptôme initial** : (1) la TOC listait des "titres" qui étaient en fait des `#` à l'intérieur d'un fenced code block ou du frontmatter YAML ; (2) cliquer sur un titre ne faisait pas scroller l'éditeur dans plusieurs modes.
- **Cause** : (1) regex naïve `^(#{1,6})\s+(.+)$` sans état pour détecter les blocs de code ou le frontmatter ; (2) le sélecteur de scroll utilisait `[contenteditable="true"]`, qui retourne `null` ou la mauvaise cible quand Muya est en lock mode (per-tab readOnly), en mode split avec source (contenteditable forcé à false), ou en pure source mode (Muya hidden, scrollIntoView no-op). De plus, la logique d'extraction était dupliquée entre `editor.ts:9-27` et `TocPane.svelte:27-37`, et le store `editor.toc` n'avait aucun consumer (dead code).
- **Fix** :
  - Pure module `src/lib/services/toc.ts` avec state machine qui skip les fenced code blocks ` ``` ` et `~~~` (règles CommonMark de fermeture, indent ≤ 3 spaces, fence min length) et le frontmatter YAML (`---` au début de fichier, défensif si non clos = `[]`).
  - 22 tests TDD dans `tests/services/toc.test.ts` (basics, fences, frontmatter, scénarios mixtes).
  - Le store `editor.toc`, sa fonction `extractHeadings` locale, le timer `tocDebounceTimer` et la fonction `debouncedTocUpdate` sont supprimés. `TocPane.svelte` appelle directement `extractHeadings(tab.content)` sur changement de tab actif.
  - `scrollToHeading` prend maintenant la position source (`pos`) au lieu du texte, et navigue par index (Nth heading dans le markdown = Nth `<hN>` dans le DOM Muya). Gère correctement les headings dupliqués.
  - Sélecteur changé en `.muya-editor`. Le cas Muya hidden (source mode) est explicitement détecté avec un `dlog('toc', '...')` au lieu d'échouer silencieusement.
- **Doc associée** : sujet `'toc'` ajouté à `DebugSubject` (`src/lib/stores/debug.ts`) — activable via Ctrl+Shift+D.
- **Limite restante** : navigation TOC en pure source mode pas implémentée (Muya est hidden, le scroll DOM ne fait rien). Pourrait à l'avenir scroller le `<textarea>` source via la position offset (déjà calculée et passée au handler).

---

### Ctrl+Z se comporte mal au changement d'onglet

- **Résolu le** : 2026-05-10 (faux positif, plus reproductible). Aucun fix dédié.
- **Symptôme initial** : annuler après un changement d'onglet ramenait parfois à un état inattendu, ou ne faisait rien, ou semblait sauter des étapes. La doc soupçonnait l'empilement de trois mécanismes : Muya history interne, `historyCache` snapshot/restore au tab switch, intercept Ctrl+Z/Y en capture phase pour contourner WebKitGTK.
- **Vérification** : non reproductible après la refonte du split mode (commits `5af588f` à `3fcc63c` du 2026-05-10) et l'unification de la matrice des modes éditeur (`computeModeToggle` + `canToggleMode` dans `editorModes.ts`). Les conditions de course liées à des `setMarkdown()` mal séquencés autour des changements de mode/tab ont été éliminées.
- **Conclusion** : pas de fix de la chaîne d'historique elle-même, mais le contexte qui la déclenchait n'existe plus. Le sujet `ctrlz` reste instrumenté (`dlog('ctrlz', …)`, voir `MuyaPane.svelte` editorKeydown + `services/muya.ts` undo/redo) pour rouvrir rapidement si une régression apparaît.

---

### Erreurs préférences silencieuses

- **Résolu le** : 2026-05-10, commit `242a453`.
- **Symptôme initial** : `invoke('save_preferences', ...).catch((e) => console.warn(...))` dans `src/lib/stores/preferences.ts` log seulement. Côté `save()`, aucun `catch` du tout — la promesse rejetée remontait dans des call sites en `setTimeout` non-await, donc unhandled silently.
- **Fix** : `save()` enroule `invoke` en try/catch + `showToast(tr('error_prefs_save'), 'error')` puis re-throw. `patch()` appelle `.catch(reportSaveError)` sur sa promesse fire-and-forget. Helpers internes `reportWarnings` et `reportSaveError` traduisent via `get(t)` (le store i18n est lu à l'instant du toast). Nouvelle clé i18n `error_prefs_save` × 8 locales.

---

### Backup `.bak` silencieux

- **Résolu le** : 2026-05-10, commit `242a453`.
- **Symptôme initial** : `save_preferences` (Rust) loggait un warning et continuait l'écriture principale si la copie `.bak` ne pouvait pas être écrite. L'utilisateur ne savait pas qu'il venait de perdre son backup.
- **Fix** : `save_preferences` retourne désormais `Result<SaveResult, AppError>` au lieu de `Result<(), AppError>`. `SaveResult` contient un `Vec<String>` de codes de warning. La constante `WARN_BACKUP_FAILED = "prefs_backup_failed"` est ajoutée au vec quand `fs::copy(&path, &backup)` échoue. L'écriture principale n'est pas bloquée. Côté frontend, `reportWarnings` traduit chaque code en clé i18n `warning_<code>` et toast en kind `warning`. Nouvelle clé `warning_prefs_backup_failed` × 8 locales.

---

### Fallback `/tmp` pour les préférences

- **Résolu le** : 2026-05-10, commit `242a453`.
- **Symptôme initial** : si la config dir XDG est inaccessible, les préférences sont sauvées dans `/tmp/miramd/preferences.json`, perdues au reboot. Aucun feedback à l'utilisateur.
- **Fix** : `prefs_path()` est devenu `prefs_path_with_warnings()` qui retourne `(PathBuf, Vec<String>)`. Quand le `.unwrap_or_else` du chemin atterrit sur `/tmp`, on pousse `WARN_TMP_FALLBACK = "prefs_tmp_fallback"` dans le vec. `load_preferences` retourne `LoadResult { prefs, warnings }` ; le frontend toast une fois au démarrage. **`save_preferences` discard le warning du même appel** (`let (path, _) = prefs_path_with_warnings();`) pour éviter un toast à chaque keystroke-driven save. Nouvelle clé `warning_prefs_tmp_fallback` × 8 locales.

---

### Migration de schéma préférences non implémentée

- **Résolu le** : 2026-05-10, commit `75b50c2`. (Squelette uniquement — aucune migration v0→v1 réelle aujourd'hui, mais l'emplacement est prêt pour la prochaine breaking change.)
- **Symptôme initial** : `prefs_version: u32` déclaré dans la struct mais jamais lu. À la première migration breaking, les utilisateurs auraient perdu leurs settings.
- **Fix** : Constante `CURRENT_PREFS_VERSION = 1`, `default_prefs_version()` pointe sur la constante. Helper `migrate_preferences(&mut prefs) -> MigrationResult` avec trois branches :
  - `AlreadyCurrent` (no-op),
  - `Migrated { from }` (chaîne `if from < N` à compléter, persiste après),
  - `FutureVersion { actual }` (cas downgrade : la lecture est best-effort, on warn `prefs_future_version`).
  `load_preferences` appelle ce helper, persiste si migré, push le warning si futur. **Garde-fou test** `test_default_prefs_version_matches_current` empêche la dérive entre la valeur par défaut serde et la cible de migration. 4 tests + nouvelle clé i18n `warning_prefs_future_version` × 8 locales.

---

### Validation CLI dupliquée

- **Résolu le** : 2026-05-10, commit `488f2a6`.
- **Symptôme initial** : le guard `path.exists() && path.is_file() && is_markdown_file(path)` était dupliqué entre le single-instance handler (`lib.rs:40`) et le setup principal (`lib.rs:64`).
- **Fix** : helper `validated_cli_file(args: &[String]) -> Option<String>` extrait le pattern. Les deux call sites se réduisent à `if let Some(file_path) = validated_cli_file(&args) { … }` et `app.manage(CliFile(validated_cli_file(&args)));`. Le helper utilise `args.get(1)?` pour gérer l'absence d'argument et `(predicate).then(|| arg.clone())` pour le retour conditionnel idiomatique. -18/+12 lignes nettes.

---

### Pas de timeout IPC

- **Résolu le** : 2026-05-10, commit `cde5017`.
- **Symptôme initial** : si une commande Tauri se figeait (deadlock Rust, disque réseau cassé, parse markdown sur un fichier extrême), le `await invoke(...)` côté frontend ne reprenait jamais — l'UI gelait sans aucune indication.
- **Fix** : nouveau module `src/lib/services/ipc.ts` exposant :
  - `withTimeout(promise, command, timeoutMs)` — race une promesse contre un `setTimeout`, rejette `IpcTimeoutError` si le délai expire. Pure et testable.
  - `invokeWithTimeout<T>(command, args?, timeoutMs?)` — drop-in pour `invoke`, default `DEFAULT_IPC_TIMEOUT_MS = 30_000`.
  - `IpcTimeoutError` qui porte `command` et `timeoutMs` pour le debug.

  **Le Rust n'est pas annulé** — la promesse JS abandonne juste l'attente. Appliqué aux flows user-initiated : `read_file`, `write_file`, `list_directory_entries`, `get_cli_file` (30 s par défaut) ; `load_preferences` et `save_preferences` (5 s, vu que c'est un petit JSON). Hot paths laissés en `invoke` direct : `set_app_zoom` (zoom wheel ticks). 6 tests vitest couvrent le résolu-avant-deadline, le timeout, la propagation d'erreur, et le `clearTimeout` de cleanup pour ne pas leaker.

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
