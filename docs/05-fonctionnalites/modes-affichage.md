# Modes d'affichage

MiraMD propose plusieurs **modes d'affichage** qui changent la façon dont l'éditeur se présente : voir le code Markdown brut, atténuer ce qui n'est pas le paragraphe courant, garder le curseur centré verticalement, afficher source et preview côte à côte, ou verrouiller l'édition.

## Vue utilisateur

Cinq modes, indépendants ou combinables selon les compatibilités.

**Mode source.**

- Affiche le Markdown brut (avec toutes les balises `**`, `# `, `- `, etc.) dans un textarea simple, à la place du rendu [WYSIWYG](edition-wysiwyg.md).
- Activable depuis les [préférences](preferences.md) → section "Vue", ou via un bouton dans l'interface (à vérifier).
- En entrant en mode source, MiraMD reprend le contenu courant de [Muya](../01-decouverte/glossaire.md#muya), normalise les lignes vides, et l'affiche dans le textarea. En sortant, le contenu modifié est repoussé vers Muya.
- Entrer en mode source désactive automatiquement les modes **focus** et **machine à écrire** (incompatibles).

**Mode focus.**

- Atténue visuellement (réduction d'opacité) tous les paragraphes **sauf celui où se trouve le curseur**. Aide à la concentration sur le passage en cours d'écriture.
- Activable depuis les préférences → section "Vue".
- Géré par Muya en interne (option `focusMode: true` passée à l'instance).

**Mode machine à écrire (typewriter).**

- Garde le curseur **vertical centré** au milieu de l'écran. Quand tu tapes, le texte défile vers le haut au lieu de descendre vers le bas. C'est l'effet "rouleau" d'une machine à écrire.
- Activable depuis les préférences → section "Vue".
- Implémenté côté MiraMD (pas de Muya) avec un *throttle* à 50 ms pour éviter les ralentissements lors de la frappe rapide.

**Vue scindée (split).**

- Disponible uniquement quand le mode source est actif.
- Affiche le textarea source à gauche **et** le rendu Muya à droite, en parallèle. Tu écris dans la source, tu vois le rendu en preview.
- Le pane Muya est en mode lecture seule pendant le split (le contenteditable est désactivé). La sync est strictement unidirectionnelle source → preview.
- La sync de **contenu** source → preview passe par un debounce 400 ms.
- La sync de **scroll** source → preview utilise un alignement **ancré sur les headings** (`computeAnchoredScroll` dans `src/lib/services/splitScrollSync.ts`) : chaque heading source ↔ heading preview est un point d'alignement exact ; entre deux headings, on interpole proportionnellement. Si le document n'a aucun heading, fallback proportionnel. Throttlé à 1 frame via `requestAnimationFrame`. Anchors reconstruits à chaque scroll via `extractHeadings()` (toc.ts).
- **`alignOffsetY`** : paramètre de `computeAnchoredScroll` qui déplace l'alignement vertical dans le viewport preview (0 = haut). SourcePane maintient une variable `referenceY` mise à jour au double-clic (= clientY du clic relatif au textarea) et réutilisée par le scroll. Conséquence : (1) après un double-clic, l'élément cible apparaît à la **même hauteur visuelle** dans la preview que le curseur dans la source ; (2) les scrolls ultérieurs gardent cette référence — pas de "snap" vers le haut.
- **Double-clic pour focus** : double-cliquer dans le textarea source met à jour `referenceY`, fait un scroll smooth de la preview, et applique pendant ~1,6s une classe `.split-click-target` au bloc rendu le plus proche (heading, paragraphe, liste, code, table, hr) — outline accent pulsant local. Single-click ne déclenche aucun sync visuel.
- **Live preview avec focus préservé** : `muyaService.setMarkdown(value)` re-render le DOM du pane et essaie de voler le focus du textarea (WebKitGTK quirk). Solution agressive dans `applySetMarkdownPreservingFocus()` : (1) un **focusin guardian** sur `document` (capture phase) qui intercepte tout focus shift vers `previewPane` et refocus immédiatement le textarea ; (2) **plusieurs tentatives de refocus** (sync, microtask via `Promise.resolve()`, `requestAnimationFrame`, raf+raf, et un final 200ms après) ; (3) le guardian est désinstallé après 200ms. Debounce du push : 400ms. Sur blur, flush immédiat.
- **Sélection autorisée dans la preview** : `user-select: text` sur `.split-active .wysiwyg-pane` (au lieu de `none`). L'utilisateur peut sélectionner et copier le texte rendu. Le `contenteditable=false` reste en place donc le pane n'est pas éditable.
- **Highlight du mot exact en double-clic** : `highlightWordInPreview()` extrait le mot via `selectionStart`..`selectionEnd`, compte son occurrence (word-boundary) dans la source jusqu'au curseur, retrouve la même occurrence dans la preview via TreeWalker, puis **enveloppe le range dans un `<span class="split-word-highlight">`** (approche span-wrapping). Plus prévisible que CSS Highlight API ou Selection API qui ont des quirks suivant l'élément hôte (heading, lien, paragraphe) sur WebKitGTK. Si `surroundContents` échoue (range cross-boundary), fallback sur l'outline du bloc (`flashClickTarget`).
- **Mode delta après double-clic (no-rollback)** : après chaque double-clic, on capture `scrollAnchor = { srcScroll, dstScroll }`. `handleScroll` switche alors en **mode delta** : `previewScrollTop = anchor.dstScroll + (textarea.scrollTop - anchor.srcScroll) * (dstMax / srcMax)`. Pas de recompute via `scrollTop+referenceY`, donc plus de rollback. Avant tout double-clic (ou après tab switch qui reset l'anchor), le scroll utilise le mode anchored par défaut (heading-based). `suppressScrollSyncUntil = +500ms` reste en place pour laisser le smooth scroll atterrir avant que le delta-mode prenne la main.
- **Cleanup unifié des highlights** : `clearAllSplitHighlights()` est appelé en tête de chaque double-clic — retire **TOUS** les `.split-word-highlight` présents dans la preview (pas seulement celui dont on a la référence : couvre les leftovers après re-render Muya, double-clic rapide cross-blocs, etc.) **et** l'outline du précédent bloc. Garantit qu'une seule sélection accentuée est visible à la fois.
- **Word boundaries pour l'occurrence count** : `findTextOccurrence` et le compteur dans `highlightWordInPreview` utilisent `\b<word>\b` (regex word-boundary) au lieu de `indexOf`, pour ne pas confondre `the` dans `weather`.
- **Layout** : 50/50 source/preview en split. Le padding interne du pane preview est resserré en split (`16px 12px 100px 12px` au lieu de `20px 50px 100px 50px`) pour laisser plus de place au contenu rendu, qui est déjà contraint en largeur par le partage.

**Mode lecture seule (par onglet).**

- Verrouille toute édition. Aucune frappe n'est acceptée (sauf navigation et copie). Le curseur Muya est retiré et les marqueurs source (`**`, ` `` `, `#`) restent invisibles, donnant un rendu propre style preview.
- **Per-tab** : chaque onglet a son propre état de verrou. Tu peux travailler sur l'onglet A sans modifier l'onglet B verrouillé, et vice versa. L'état n'est **pas persisté** : au prochain démarrage, tous les onglets repartent éditables.
- Activable via le toggle cadenas (composant `LockToggle.svelte`, coin haut-gauche du pane Muya) ou via le bouton "Édition / Lecture seule" de la status bar — les deux contrôlent l'onglet actif.
- Implémentation : classe CSS `.muya-readonly` sur `<body>` qui cache `.ag-float-wrapper` (toolbar Muya) et `.ag-remove` (markers) ; intercept des événements `keydown`/`beforeinput`/`paste` avec whitelist Ctrl+C, Ctrl+A, Ctrl+B (sidebar), Ctrl+,, et flèches / Page Up/Down / Home / End.

## Implémentation

La machine à états des modes est centralisée dans un service dédié, qui dérive son état des [préférences](preferences.md) et expose des toggles cohérents.

**Composants Svelte concernés** :

- `src/lib/components/editor/EditorContainer.svelte` — orchestre l'affichage des deux panes (source et WYSIWYG) selon le mode courant.
- `src/lib/components/editor/MuyaPane.svelte` — pane WYSIWYG, met à jour son attribut `contenteditable` selon les modes (en split + source actif → désactivé). Initialise le typewriter scroller.
- `src/lib/components/editor/SourcePane.svelte` — le textarea source, debounce 400 ms vers Muya.
- `src/lib/components/editor/LockToggle.svelte` — l'icône cadenas pour activer/désactiver la lecture seule.
- `src/lib/components/settings/ViewSection.svelte` — la section "Vue" des préférences, où on toggle tous les modes.

**Services concernés** :

- `src/lib/services/editorModes.ts` — la **machine à états**. Singleton qui :
  - Expose un store `state` dérivé qui combine `preferences` (sourceCodeMode, splitView, focusMode, typewriterMode) **et** `editor.activeTab.readOnly` (per-tab).
  - Expose un store `sourceContent` qui est la source de vérité du textarea source.
  - Fournit les toggles `toggleReadOnly` (sur l'onglet actif), `toggleSource`, `toggleSplit`, `toggleFocus`, `toggleTypewriter`.
  - Gère la transition entrée/sortie du mode source (récupère contenu Muya → normalize → affiche, et inversement).
  - Installe les handlers `keydown` / `beforeinput` / `paste` en capture phase pour le mode lecture seule (lit `editor.activeTab?.readOnly`).
  - Toggle la classe `.muya-readonly` sur `<body>` quand l'onglet actif change ou quand son état readOnly change.
  - Propage les changements de préférences à Muya via `MuyaService.applyPreferences(p)`.
- `src/lib/services/typewriterScroller.ts` — gestion du mode machine à écrire.
  - `initTypewriterScroller(getPaneElement, isEnabled)` retourne une liste de cleanups.
  - Throttle 50 ms : si un scroll est déjà programmé, ignore les events suivants.
  - Calcule la position du curseur via `window.getSelection().getRangeAt(0).getBoundingClientRect()`, calcule l'offset par rapport au centre du pane, applique `scrollBy({ top: offset, behavior: 'smooth' })`.
  - Branche aussi sur `keyup` et `mouseup` pour rattraper les événements que `selectionChange` ne capture pas toujours.

**Backend Rust impliqué** : aucun directement. Les modes sont des préférences, persistées via `save_preferences` (cf. [`preferences.md`](preferences.md)).

**Stores impactés** :

- `preferences` — modes globaux : `sourceCodeMode`, `splitView`, `focusMode`, `typewriterMode`. ReadOnly **n'est plus là** depuis 2026-05-08 — il vit sur le `Tab` (cf. ci-dessous).
- `editor.tabs[*].readOnly` — état booléen par onglet, session-only.
- `editorModes.state` — store dérivé qui expose une vue aplatie des cinq modes.
- `editorModes.sourceContent` — le contenu courant du textarea source.

**Comment les modes interagissent** :

- Source actif ⇒ désactive automatiquement Focus, Typewriter, et Typewriter Sounds (incompatibles).
- Source désactivé ⇒ désactive automatiquement Split (Split exige Source actif).
- Split ⇒ exige que Source soit actif. Le pane Muya bascule en lecture seule (`contenteditable="false"`), seul le textarea source est éditable.
- ReadOnly (per-tab) est indépendant : combinable avec n'importe quel autre mode.

**Mise en application UI** : les boutons de la status bar et les toggles dans les préférences sont **grisés (disabled)** quand le mode n'est pas activable :
- Focus + Typewriter grisés quand Source est actif.
- Split grisé quand Source est inactif.

Implémenté par deux helpers purs dans `editorModes.ts` :
- `computeModeToggle(prefs, mode)` — retourne le patch à appliquer (avec les side effects de compatibilité).
- `canToggleMode(prefs, mode)` — prédicat utilisé par les `<button disabled={...}>` et `<input disabled={...}>`.

Les deux sont testés exhaustivement dans `tests/services/editorModes.test.ts`.

## Pièges connus

- **Désynchronisation source ↔ WYSIWYG en mode split** : **résolu par design** depuis la simplification du split (le pane Muya est désormais en lecture seule, donc la sync est unidirectionnelle source → preview, plus de race possible côté Muya). Le debounce 400 ms reste pour le throttle de la sync, sans risque de divergence puisque le pane preview ne peut plus écrire.

- **Pas de bouton clairement identifié pour basculer en mode source dans toutes les vues** : à vérifier visuellement. Le toggle existe dans la section "Vue" des préférences ; un raccourci direct (Ctrl+/) n'est pas implémenté dans `services/shortcuts.ts` à la lecture du code.

- **Mode lecture seule + sidebar Ctrl+B** : la whitelist des touches autorisées en read-only laisse passer Ctrl+B (volontairement, pour permettre le toggle sidebar quand l'éditeur n'est pas focus). Mais cela peut produire un comportement contre-intuitif si l'utilisateur s'attendait à ce que tout raccourci soit bloqué.

- **Throttle typewriter** : 50 ms. Sur une machine très lente, le scroll peut sauter une frappe (rare, mais possible).

## Pour aller plus loin

- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — modèle des trois couches, où vit `editorModes` dans la couche de services frontend.
- [`preferences.md`](preferences.md) — comment les modes sont persistés et synchronisés.
- [`edition-wysiwyg.md`](edition-wysiwyg.md) — la couche d'édition par défaut dont les modes sont des variantes.
- [`onglets-et-historique.md`](onglets-et-historique.md) — au tab switch, certains modes (focus, typewriter) sont préservés ; le mode source rebascule sur le contenu du nouvel onglet.
