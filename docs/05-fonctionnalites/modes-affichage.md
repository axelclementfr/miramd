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
- La sync de **scroll** source → preview utilise un alignement **ancré sur les headings** (`computeAnchoredScroll` dans `src/lib/services/splitScrollSync.ts`) : chaque heading source ↔ heading preview est un point d'alignement exact ; entre deux headings, on interpole proportionnellement. Si le document n'a aucun heading, fallback sur `computeProportionalScroll`. Throttlé à 1 frame via `requestAnimationFrame`. Les anchors sont reconstruits à chaque scroll via `extractHeadings()` (toc.ts) — fonction O(n), assez rapide pour ne pas demander de cache supplémentaire.
- **Click pour focus** : cliquer dans le textarea source déplace la preview sur la position du curseur (`textareaEl.selectionStart`) avec un scroll smooth, et fait apparaître brièvement (≈1,2s) une **barre accent horizontale** (`.split-click-marker` dans `editor-layout.css`) au point cible — guide visuel pour repérer où le curseur a été placé. La barre est ajoutée comme enfant absolu du `.wysiwyg-pane` (rendu `position: relative` en split) puis retirée du DOM après l'animation.
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
