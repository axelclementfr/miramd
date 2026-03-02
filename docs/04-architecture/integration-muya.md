# Intégration de Muya

[Muya](../01-decouverte/glossaire.md#muya) est le **moteur d'édition [WYSIWYG](../01-decouverte/glossaire.md#wysiwyg)** hérité de MarkText. MiraMD le réutilise tel quel — pas de réécriture — mais l'embarque d'une façon particulière qui mérite explication. C'est la frontière entre du code legacy non typé (~30 000 lignes de JS dans `src/lib/muya/`) et un frontend moderne en [TypeScript](../01-decouverte/glossaire.md#typescript) + [Svelte](../01-decouverte/glossaire.md#svelte) 5.

Le contrat est simple : **un seul composant Svelte (`MuyaPane.svelte`) instancie Muya, à travers un seul singleton (`MuyaService`)**. Aucun autre fichier du projet ne touche directement Muya. Si un jour il faut migrer (cf. [`muya.md`](../../muya.md) pour la décision en cours), le point d'intégration est minimal.

## Mode de chargement — Muya en `<script>` global

Muya n'est **pas** bundlé par [Vite](../01-decouverte/glossaire.md#vite). C'est une décision explicite, pour deux raisons : éviter de re-bundler un code legacy à chaque build du frontend, et isoler le `unsafe-eval` (Muya en a besoin pour la coloration syntaxique).

La chaîne est la suivante :

1. **Source** : `src/lib/muya/` contient les sources JS originales (vendored, pas modifiées).
2. **Build Muya** : un build webpack séparé produit le bundle `static/muya/index.min.js` (~2.5 MB) et les feuilles de style `index.min.css`, `theme-base.css`, `theme-structure.css`, `theme-{dark,light,one-dark,graphite,material-dark,ulysses}.css`. (Le détail du build Muya est en dehors de la chaîne Vite ; à confirmer en lisant le script de build de Muya quand il sera reconstruit.)
3. **Inclusion HTML** : `src/app.html:18-22` charge les CSS via `<link>` et le JS via `<script src="%sveltekit.assets%/muya/index.min.js">`. C'est ce script qui pose `window.Muya`.
4. **Lecture runtime** : `services/muya.ts:25` fait `const Muya = (window as any).Muya;`. Le cast `as any` est inévitable — `window` est typé par lib.dom.d.ts qui ne connaît pas Muya. Le typage applicatif est porté par `src/lib/types/muya-instance.ts` (interface `MuyaInstance`).

Conséquence : la CSP ([`securite.md`](securite.md)) doit autoriser `script-src 'self'` (Muya est en local) **et** `'unsafe-eval'` (Muya l'utilise dans son chemin de coloration syntaxique). C'est documenté comme dette dans l'[audit](../06-references/audit.md).

## Bascule dynamique des thèmes Muya

Quand l'utilisateur change de thème, il faut aussi changer la feuille Muya. Un `<script>` inline dans `app.html:23-38` installe un `MutationObserver` sur l'attribut `data-theme` de `<html>` et remplace dynamiquement le `href` de la feuille `<link id="muya-theme">`. Le mapping est :

| `data-theme` | Feuille chargée |
|---|---|
| `dark` | `/muya/theme-dark.css` |
| `light` | `/muya/theme-base.css` |
| `one-dark` | `/muya/theme-one-dark.css` |
| `graphite` | `/muya/theme-graphite.css` |
| `material-dark` | `/muya/theme-material-dark.css` |
| `ulysses` | `/muya/theme-ulysses.css` |

Pas de FOUC marqué grâce aux backgrounds inline dans `<style>` (`app.html:9-16`).

## MuyaService — la passerelle unique

Le fichier [`src/lib/services/muya.ts`](../../src/lib/services/muya.ts) (228 lignes) déclare la classe `MuyaService`, instanciée une seule fois et exportée nommément :

```ts
export const muyaService = new MuyaService();
```

État interne :

- `private muya: MuyaInstance | null` — l'instance Muya courante.
- `private container: HTMLElement | null` — le DOM hôte.
- `private changeCallbacks: ChangeCallback[]` — listeners pour `change`.
- `private selectionCallbacks: SelectionCallback[]` — listeners pour `selectionChange`.

### Méthodes publiques (≈ 20)

Toutes les méthodes `try/catch` les appels Muya et fallback en `console.debug` en cas d'échec — pour ne jamais crasher le frontend.

| Méthode | Signature | Rôle |
|---|---|---|
| `init` | `init(element: HTMLElement, prefs: Preferences): MuyaInstance \| null` | Lit `(window as any).Muya`, instancie `new MuyaClass(element, options)` avec ~30 options issues des préférences, branche les events `change` / `selectionChange`, met à jour le store `muyaInstance`. |
| `destroy` | `destroy(): void` | Appelle `muya.destroy()`, vide les callbacks, met `muyaInstance` à `null`. |
| `getMarkdown` | `getMarkdown(): string` | Retourne le Markdown courant (string). Renvoie `''` si pas prêt. |
| `setMarkdown` | `setMarkdown(md: string): void` | Remplace le contenu. |
| `undo` | `undo(): void` | Annulation interne Muya. |
| `redo` | `redo(): void` | Refait. |
| `clearHistory` | `clearHistory(): void` | Vide la pile undo/redo de Muya. |
| `getHistory` | `getHistory(): unknown` | Retourne un snapshot opaque de l'historique. |
| `setHistory` | `setHistory(history: unknown): void` | Restaure un snapshot. Utilisé par `historyCache` au tab switch. |
| `getCursor` | `getCursor(): unknown` | Position courante du curseur (objet opaque). |
| `selectAll` | `selectAll(): void` | Sélectionne tout le document. |
| `focus` | `focus(): void` | Donne le focus à l'éditeur. |
| `setFocusMode` | `setFocusMode(enabled: boolean): void` | Active/désactive le mode focus (paragraphes inactifs grisés). |
| `setFont` | `setFont({fontSize, lineHeight}): void` | Change la fonte sans réinit. |
| `setOptions` | `setOptions(opts: Record<string, unknown>, silent?: boolean): void` | Mise à jour batch d'options Muya. |
| `applyPreferences` | `applyPreferences(p: Preferences): void` | Compose `setFont` + `setFocusMode` + `setOptions` avec ~28 champs des préférences (`muya.ts:161-199`). |
| `onChange` | `onChange(cb: (changes) => void): () => void` | Enregistre un callback ; retourne un unsubscriber. |
| `onSelectionChange` | `onSelectionChange(cb: () => void): () => void` | Idem pour les changements de sélection. |
| `isReady` | `isReady(): boolean` | `true` si l'instance existe. |
| `getInstance` | `getInstance(): MuyaInstance \| null` | Accès direct à l'instance, **réservé** à `editorModes` (pour `blur`) et à `MuyaPane` (pour le tab switching). À éviter ailleurs. |

## Cycle de vie — `MuyaPane.svelte`

Le composant [`src/lib/components/editor/MuyaPane.svelte`](../../src/lib/components/editor/MuyaPane.svelte) (204 lignes) est **le seul** qui instancie Muya. Voici l'ordre exact des opérations dans son `onMount` (`MuyaPane.svelte:27-167`) :

1. **Lecture des préférences** — `const prefs = get(preferences);`.
2. **Init de Muya** — `muyaService.init(editorElement, prefs)`. Si l'instance retournée est `null` (script Muya pas chargé), on retourne immédiatement.
3. **Suppress initial change events** — flag `loadingTab = true` puis `setTimeout(() => loadingTab = false, 50)`. Évite que le premier rendu déclenche un `updateContent` parasite.
4. **Init des services dépendants** — `zoomService.init()` et `lineNumbersService.init(paneElement)`.
5. **Intercept clavier en capture phase** (cf. section dédiée plus bas) — Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+A.
6. **Subscribe aux préférences** — pour synchroniser `sourceCodeMode`, `splitView`, `readOnly`, `typewriterMode`, et basculer `contenteditable`.
7. **Branchement du callback `onChange`** — debounce 100 ms pour `editorStore.updateContent`, debounce 300 ms pour `updateStats`.
8. **Init typewriter** — `initTypewriterScroller(...)` retourne une liste de cleanups à pousser dans `unsubs`.
9. **Subscribe à `editorStore.activeTab`** — sauvegarde de l'historique du tab sortant via `historyCache.set`, restauration pour le tab entrant via `historyCache.get` + `setHistory` (ou `clearHistory` si pas de cache).
10. **Cleanup historyCache** — subscribe à `editorStore.tabs` pour appeler `historyCache.cleanUp(...)` quand un onglet est fermé.
11. **Focus** — `setTimeout(() => muyaService.focus(), 100)`.

Au `onDestroy` (`MuyaPane.svelte:169-174`) : exécution de tous les `unsubs`, `zoomService.destroy()`, `lineNumbersService.destroy()`, `muyaService.destroy()`.

## Événements interceptés

Muya émet deux événements pertinents pour MiraMD :

### `change` — debounce 100 ms

`MuyaPane.svelte:91-114`. À chaque modification de contenu :

1. Si `loadingTab` ou `readOnly`, on ignore.
2. Si `sourceCodeMode && !splitView`, on ignore (le textarea source est la source de vérité, pas Muya).
3. On capture `tabId` **immédiatement** (avant le timer) pour éviter qu'un changement de tab pendant le debounce ne pollue le mauvais onglet.
4. Après 100 ms : on récupère `changes.markdown || muyaService.getMarkdown()` et on appelle `editorStore.updateContent(tabId, md)`.
5. En parallèle, debounce 300 ms pour `updateStats(...)`.

Au tab switch, les timers sont annulés explicitement (`MuyaPane.svelte:131-132`) pour éviter qu'un debounce en flight n'écrive dans le nouveau tab.

### `selectionChange`

`MuyaPane.svelte:117-121` (via `initTypewriterScroller`). Utilisé uniquement pour le mode typewriter — repositionner le viewport pour garder le curseur centré (throttle 50 ms via `requestAnimationFrame`).

## Configuration initiale — options passées à `new MuyaClass`

À l'instanciation (`muya.ts:32-66`), 31 options sont fournies, toutes issues des préférences. Le tableau ci-dessous donne le mapping précis.

| Option Muya | Valeur depuis `prefs` | Default si absent |
|---|---|---|
| `markdown` | `''` (vide à l'init) | — |
| `fontSize` | `prefs.fontSize` | `16` |
| `lineHeight` | `prefs.lineHeight` | `1.6` |
| `focusMode` | `prefs.focusMode` | `false` |
| `autoPairBracket` | `prefs.autoPairBracket` | `true` |
| `autoPairMarkdownSyntax` | `prefs.autoPairMarkdownSyntax` | `true` |
| `autoPairQuote` | `prefs.autoPairQuote` | `true` |
| `bulletListMarker` | `prefs.bulletListMarker` | `'-'` |
| `orderListDelimiter` | `prefs.orderListDelimiter` | `'.'` |
| `tabSize` | `prefs.tabSize` | `4` |
| `codeBlockLineNumbers` | `prefs.codeBlockLineNumbers` | `true` |
| `listIndentation` | `prefs.listIndentation` | `1` |
| `frontmatterType` | `prefs.frontmatterType` | `'-'` |
| `sequenceTheme` | `prefs.sequenceTheme` | `'hand'` |
| `mermaidTheme` | `prefs.mermaidTheme` | `'default'` |
| `vegaTheme` | `prefs.vegaTheme` | `'latimes'` |
| `hideQuickInsertHint` | `prefs.hideQuickInsertHint` | `false` |
| `hideLinkPopup` | `prefs.hideLinkPopup` | `false` |
| `autoCheck` | `prefs.autoCheck` | `false` |
| `spellcheckEnabled` | `prefs.spellcheck` | `false` |
| `superSubScript` | `prefs.superSubScript` | `false` |
| `footnote` | `prefs.footnote` | `false` |
| `isGitlabCompatibilityEnabled` | `prefs.isGitlabCompatibilityEnabled` | `false` |
| `disableHtml` | `!(prefs.isHtmlEnabled ?? true)` | `false` (HTML activé par défaut) |
| `trimUnnecessaryCodeBlockEmptyLines` | `prefs.trimUnnecessaryCodeBlockEmptyLines` | `true` |
| `trimTrailingNewline` | `prefs.trimTrailingNewline` | `2` |
| `textDirection` | `prefs.textDirection` | `'ltr'` |
| `codeFontFamily` | `prefs.codeFontFamily` | `'DejaVu Sans Mono'` |
| `codeFontSize` | `prefs.codeFontSize` | `14` |
| `endOfLine` | `prefs.endOfLine` | `'default'` |
| `editorLineWidth` | `prefs.editorLineWidth` | `''` |
| `preferLooseListItem` | `prefs.preferLooseListItem` | `true` |
| `preferHeadingStyle` | `prefs.preferHeadingStyle` | `'atx'` |

Quand l'utilisateur modifie ces options via `SettingsModal`, ce **n'est pas** une réinit complète : `muyaService.applyPreferences(prefs)` (`muya.ts:161-199`) appelle `setFont`, `setFocusMode`, et `setOptions(...)` en mode silent. C'est ce qui permet de changer la fonte ou les délimiteurs de liste sans perdre le curseur ou l'historique.

## Couches custom autour de Muya

Quatre mécanismes propres à MiraMD viennent compléter Muya :

### 1. `historyCache` — historique par onglet

Fichier : [`src/lib/services/historyCache.ts`](../../src/lib/services/historyCache.ts) (31 lignes).

Muya gère son propre undo/redo, mais **une seule pile à la fois** (l'instance est unique). Pour préserver l'historique au changement d'onglet, MiraMD :

1. Avant de quitter le tab `prevTabId` : `historyCache.set(prevTabId, muya.getHistory())` (snapshot opaque).
2. Charge le contenu du nouveau tab : `muya.setMarkdown(tab.content)`.
3. Si un cache existe pour le nouveau tab : `muya.setHistory(cached)`. Sinon `muya.clearHistory()`.

Voir `MuyaPane.svelte:127-158`. Le cache est nettoyé au close de tab via `historyCache.cleanUp(activeIds)` (`historyCache.ts:25-30`).

### 2. `typewriterScroller` — curseur centré (throttled)

Fichier : [`src/lib/services/typewriterScroller.ts`](../../src/lib/services/typewriterScroller.ts) (57 lignes).

Quand `preferences.typewriterMode` est actif, on s'abonne à `onSelectionChange` et `onChange` de Muya plus à `keyup` / `mouseup` document. À chaque déclenchement, throttle 50 ms via `setTimeout`, puis `requestAnimationFrame` pour calculer la position du curseur (`Range.getBoundingClientRect()`) et faire défiler le pane pour le ramener au centre vertical (`scrollBy({ top: offset, behavior: 'smooth' })`).

Le throttle évite tout layout thrashing pendant les frappes rapides.

### 3. `lineNumbersService` — numérotation des paragraphes

Fichier : [`src/lib/services/lineNumbers.ts`](../../src/lib/services/lineNumbers.ts) (34 lignes).

Subscribe à `preferences.editorLineNumbers` et toggle la classe CSS `show-line-numbers` sur le pane WYSIWYG. Les règles CSS qui dessinent les numéros vivent dans `src/lib/styles/editor.css` (sélecteur `.wysiwyg-pane.show-line-numbers`). Indépendant de la numérotation **dans** les blocs de code (qui est une option Muya `codeBlockLineNumbers`).

### 4. Intercept Ctrl+Z/Ctrl+Y en capture phase

Code : `MuyaPane.svelte:44-70`.

**Pourquoi** : sur [WebKitGTK](../01-decouverte/glossaire.md#webkitgtk) (Linux), le moteur ne supporte pas l'undo natif d'un `contenteditable`. Sous Chromium ou Electron, Ctrl+Z appellerait l'undo natif du navigateur. Sur WebKitGTK, rien ne se passe — Muya doit le faire explicitement.

**Comment** : `paneElement.addEventListener('keydown', editorKeydown, true)` — le `true` impose la **capture phase**, donc l'événement est traité avant que WebKitGTK ou Muya y touchent. On `preventDefault()` + `stopPropagation()` puis on appelle `muyaService.undo() / .redo() / .selectAll()`. Un `invoke('debug_log', ...)` trace l'opération en mode debug.

## Cas limites et points d'attention

- **Race au changement de tab** : sans la capture du `tabId` au début du callback `onChange` (`MuyaPane.svelte:96`), un debounce en flight pourrait écrire dans le mauvais onglet. C'est aussi pour ça que les timers sont annulés explicitement au tab switch.
- **`disableHtml`** : par défaut HTML activé (`prefs.isHtmlEnabled` = true). Si on désactive, Muya rejette les balises brutes. Combiné avec `comrak unsafe_=false` côté Rust ([`securite.md`](securite.md)), la pile bloque le HTML inline à deux endroits.
- **`window.Muya` absent** : `muyaService.init` log `console.error` et retourne `null`. `MuyaPane.svelte:32` propage le `return` — l'éditeur reste vide mais l'app ne crash pas.
- **`getInstance()` exposé** : utilisé par `editorModes.ts:81-83` pour appeler `instance.blur(true, true)` en mode read-only. C'est l'unique point où l'API Muya brute fuit hors de `MuyaService` ; elle est documentée dans le commentaire ligne 222.

## Pour aller plus loin

- Pourquoi Muya est conservé : [`muya.md`](../../muya.md) (analyse décisionnelle).
- Le flux exact "tu tapes" : [`flux-de-donnees.md`](flux-de-donnees.md).
- Implications sécurité (`unsafe-eval`, sandboxing) : [`securite.md`](securite.md).
- Comment Vite + le build Muya s'articulent : [`build-et-packaging.md`](build-et-packaging.md).
