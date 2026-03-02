# Frontend Svelte

Le frontend de MiraMD est une **application [SvelteKit](#) en mode SPA** ([adapter-static](#) avec fallback `index.html`) écrite en [TypeScript](../01-decouverte/glossaire.md#typescript). Elle est compilée par [Vite](../01-decouverte/glossaire.md#vite) en quelques fichiers statiques que Tauri sert à la [WebView](../01-decouverte/glossaire.md#webview). Toute la logique d'orchestration (composants, [stores](../01-decouverte/glossaire.md#store-svelte), services [singletons](../01-decouverte/glossaire.md#singleton)) vit dans `src/lib/`.

Le code n'inclut **pas** [Muya](../01-decouverte/glossaire.md#muya) au sens du bundle Vite : Muya est chargé séparément en `<script>` global dans `app.html`. Le détail est dans [`integration-muya.md`](integration-muya.md).

## Structure de `src/lib/`

| Sous-dossier | Rôle |
|---|---|
| `components/` | Composants Svelte 5 (toolbar, sidebar, panels, settings…). |
| `services/` | Logique métier réutilisable, sans UI (singletons et fonctions pures). |
| `stores/` | Conteneurs réactifs partagés ([writable](#) et [derived](#)). |
| `types/` | Définitions [TypeScript](../01-decouverte/glossaire.md#typescript) (`Tab`, `MuyaInstance`, `Preferences`…). |
| `styles/` | CSS global, layout, themes, file-icons. |
| `i18n/` | Système de traduction (FR / EN), `index.ts` + `locales/`. |
| `muya/` | Code source vendored de [Muya](../01-decouverte/glossaire.md#muya) (legacy JS). Pas touché par Vite, voir [`integration-muya.md`](integration-muya.md). |
| `constants.ts` | Constantes UI (tailles min, zoom, theme→bg, auto-save delay). |

L'entrée applicative se trouve dans `src/routes/+page.svelte`. Une seule [route](#) : `/` (mode SPA).

## Arbre des composants

À partir de `src/routes/+page.svelte`, voici la hiérarchie des composants (chemins relatifs à `src/lib/components/`) :

```
+page.svelte (src/routes/)
├── WindowResizeEdges.svelte
├── Sidebar.svelte                 (sidebar/)
│   ├── FileTreePane.svelte        (sidebar/)
│   ├── SearchPane.svelte          (sidebar/)
│   └── TocPane.svelte             (sidebar/)
├── TitleBar.svelte
├── TabBar.svelte
├── Editor.svelte
│   └── EditorContainer.svelte     (editor/)
│       ├── MuyaPane.svelte        (editor/)  — héberge Muya
│       ├── SourcePane.svelte      (editor/)  — mode source code (textarea)
│       └── LockToggle.svelte      (editor/)  — bascule read-only
├── WelcomeScreen.svelte           (alternative à Editor si pas de tab)
├── StatusBar.svelte
├── SettingsModal.svelte           (settings/)
│   ├── ThemeSection.svelte        (settings/)
│   ├── EditorSection.svelte       (settings/)
│   ├── MarkdownSection.svelte     (settings/)
│   ├── ViewSection.svelte         (settings/)
│   └── GeneralSection.svelte      (settings/)
├── Toast.svelte
└── CustomSelect.svelte            (réutilisé dans plusieurs sections settings)
```

Le composant racine (`+page.svelte`) est **l'orchestrateur** : il charge les préférences au mount, branche les listeners IPC (`get_cli_file`, `open-file`), installe les raccourcis clavier globaux, démarre l'auto-save, applique les CSS variables (theme, font, zoom). Il n'embarque pas de logique métier — celle-ci vit dans les services.

## Tableau des stores

Les stores sont définis dans `src/lib/stores/`.

| Store | Type | Forme des données | Lecteurs principaux | Écrivains |
|---|---|---|---|---|
| `editor.tabs` | `writable<Tab[]>` | `[{id, path, name, content, savedContent, isModified}]` | `TabBar`, `MuyaPane`, `+page.svelte` | `editor.addTab`, `editor.closeTab`, `editor.updateContent`, `editor.markSaved` (`stores/editor.ts:55-105`) |
| `editor.activeTabId` | `writable<string \| null>` | UUID de l'onglet actif | `+page.svelte`, `MuyaPane`, `windowInit` | `addTab`, `closeTab` |
| `editor.activeTab` | `derived<Tab \| null>` | dérivé de `tabs` + `activeTabId` (`stores/editor.ts:47-49`) | `MuyaPane`, `fileOperations`, `StatusBar` | (lecture seule) |
| `editor.stats` | `writable<DocumentStats>` | `{words, chars, lines, paragraphs}` | `StatusBar` | `services/stats.ts → updateStats()` |
| `editor.toc` | `writable<TocEntry[]>` | `[{level, text, pos}]` (extrait via regex `^(#{1,6})\s+(.+)`, debounce 300 ms) | `TocPane.svelte` | `editor.updateContent` (debounced) |
| `muyaInstance` | `writable<any>` | référence à l'instance Muya, ou `null` | `editorModes` | `MuyaService.init/destroy` (`services/muya.ts:70,90`) |
| `preferences` | `writable<Preferences>` (custom store) | ~50 champs (voir `stores/preferences.ts:4-62`) | `+page.svelte`, `MuyaPane`, `editorModes`, `zoomService`, `lineNumbersService`, `autoSave`, toutes les sections settings | `preferences.load`, `preferences.save`, `preferences.patch` |
| `toasts` | `writable<ToastMessage[]>` | `[{id, text, kind: 'error'\|'warning'\|'info'\|'success', duration}]` | `Toast.svelte` | `showToast(text, kind, duration)` (`stores/toast.ts:13`) |

**Note importante sur `preferences`** : c'est un store custom (`createPreferencesStore`, `stores/preferences.ts:123-149`) qui expose `load`, `save`, `patch` plutôt que `set/update` directs. La méthode `patch(partial)` met à jour le store **et** envoie un `invoke('save_preferences', { prefs })` en fire-and-forget (`.catch()` qui log seulement) — un point relevé dans l'[audit](../06-references/audit.md) comme dette.

**Pas de bus d'événements** : la coordination inter-services passe par les stores. Quand un service écrit dans `preferences`, tous les autres qui sont `subscribe()` réagissent.

## Tableau des services

Les services vivent dans `src/lib/services/`. Tous sont **côté pur frontend** (pas de IPC sauf via `fileOperations.ts`).

| Service | Pattern | Responsabilité | Dépendances |
|---|---|---|---|
| `muyaService` | classe singleton (`services/muya.ts:13-228`) | Passerelle unique vers [Muya](../01-decouverte/glossaire.md#muya) : init, destroy, get/setMarkdown, undo/redo, history, focus, callbacks change/selectionChange, applyPreferences. | `window.Muya`, store `muyaInstance` |
| `editorModes` | classe singleton (`services/editorModes.ts:19-190`) | Machine à états des 5 modes : read-only, source, split, focus, typewriter. Toggles, transitions (entrée source → désactive focus/typewriter), handlers read-only en capture phase. | `preferences`, `editor`, `muyaService` |
| `zoomService` | classe singleton (`services/zoom.ts:9-42`) | Applique `preferences.zoom × fontSize` à Muya via `setFont`. Gère aussi `--editorAreaWidth` CSS variable. | `preferences`, `muyaService` |
| `lineNumbersService` | classe singleton (`services/lineNumbers.ts:11-34`) | Toggle de la classe CSS `show-line-numbers` sur le pane WYSIWYG selon `preferences.editorLineNumbers`. | `preferences` |
| `historyCache` | module (objet) (`services/historyCache.ts:9-31`) | `Map<tabId, history>`, get/set/delete/cleanUp. Persistance de l'undo/redo Muya entre tab switches. | aucune |
| `initTypewriterScroller` | factory de cleanups (`services/typewriterScroller.ts:7-57`) | Mode typewriter : maintient le curseur centré verticalement, throttle 50 ms via `requestAnimationFrame`. | `muyaService.onSelectionChange/onChange` |
| `startAutoSave` | factory (closure) (`services/autoSave.ts:8-61`) | Boucle setInterval qui rappelle `saveCallback()` toutes les `autoSaveDelay` ms si `preferences.autoSave`. Polling des prefs toutes les 2s pour redémarrer si réglage change. | `preferences`, `fileOperations.saveCurrentFile` |
| `setupKeyboardShortcuts` | factory (closure) (`services/shortcuts.ts:23-68`) | Raccourcis applicatifs niveau window : Ctrl+N/O/S/W/B/, et Ctrl+= / Ctrl+- / Ctrl+0 (zoom). Les raccourcis éditeur (Ctrl+Z/Y/A) sont dans `MuyaPane.svelte` directement. | `preferences` |
| `initWindow` | factory async (`services/windowInit.ts:23-56`) | Lazy import de `@tauri-apps/api/window`, set min size dynamique (avec/sans fichier ouvert), tracking maximized via `onResized`. | API Tauri (lazy) |
| `fileOperations` | module de fonctions (`services/fileOperations.ts`) | `openFileDialog`, `saveCurrentFile`, `closeTabWithConfirm`, `openFileFromPath`. Tous appellent `invoke(...)`. Les erreurs sont remontées via `showToast`. | `editor`, `muyaService`, dialog Tauri |
| `updateStats` / `countVisualLines` / `countSourceLines` | fonctions pures (`services/stats.ts`) | Compte mots/chars/lignes/paragraphes (gère le CJK comme caractères individuels). | `editor.stats` (set) |

## Pattern singleton — pourquoi

Plusieurs services exposent **une instance unique** exportée nommée. Exemples : `muyaService`, `editorModes`, `zoomService`, `lineNumbersService`, `historyCache`.

Raison : ces services portent un **état partagé** par toute l'application :

- `muyaService` ne peut avoir qu'**une seule instance Muya active à la fois** (un seul DOM contenteditable). Si deux composants tentaient d'instancier leur propre `MuyaService`, ils se marcheraient sur les pieds. La passerelle est donc unique, et `MuyaPane.svelte` (le seul composant qui hôte vraiment Muya) appelle `muyaService.init(element, prefs)` au mount, `muyaService.destroy()` au unmount.
- `editorModes` maintient `prevSourceCode` et les listeners read-only (capture phase) au niveau document. Les avoir multiples créerait des doubles handlers.
- `historyCache` est explicitement une `Map` partagée entre tabs (sinon, l'historique serait perdu à chaque tab switch).

Voir [glossaire — singleton](../01-decouverte/glossaire.md#singleton).

## Routes

Une seule route applicative : `/` → `src/routes/+page.svelte`.

Le mode est SPA (`svelte.config.js` : `adapter-static({ fallback: "index.html" })`). Tauri sert `index.html` puis tout est routé côté client. Pas de SSR (le binaire Tauri n'a pas de serveur Node), pas de pages multiples.

L'orchestration complète vit dans `+page.svelte` (~250 lignes) :

1. **Mount** (`onMount`, `+page.svelte:41-111`) : load preferences → subscribe `preferences` (apply theme, font, lang, zoom) → `initWindow` → `startAutoSave` → `get_cli_file` → `listen('open-file', ...)` → `setupKeyboardShortcuts`.
2. **Rendu conditionnel** : si `hasActiveTab` → `<Editor />`, sinon `<WelcomeScreen />`. Toujours : `<TitleBar>`, optionnellement `<TabBar>` et `<StatusBar>` selon les préférences.
3. **Destroy** (`onDestroy`, `+page.svelte:113-116`) : exécute toutes les fonctions accumulées dans `unsubs[]`.

## Internationalisation

`src/lib/i18n/index.ts` expose un store `t: Readable<(k: TranslationKey) => string>` et une fonction `setLanguage(lang)`. Les locales vivent dans `src/lib/i18n/locales/`. Les composants importent `t` et l'utilisent dans le template (`{tr('error_save_file')}`).

Au démarrage, `+page.svelte` synchronise la langue depuis `preferences.language` (par défaut `"fr"` côté backend, `"en"` côté frontend defaults — le backend gagne après le `load`).

## Styles et thèmes

Les CSS globales sont importées dans `+page.svelte` (`global.css`, `editor.css`, `editor-layout.css`). Elles utilisent des **CSS variables** (`--bg-primary`, `--text-primary`, `--font-size`, `--line-height`, etc.) qui sont remplies au runtime depuis les préférences.

Le thème actif est porté par l'attribut `data-theme` sur `<html>`, mis à jour dans `+page.svelte:57`. Six thèmes : `dark`, `light`, `one-dark`, `material-dark`, `graphite`, `ulysses`. Pour Muya, un `<script>` dans `app.html` observe l'attribut et **bascule dynamiquement** la feuille de style Muya correspondante (voir [`integration-muya.md`](integration-muya.md)).

Pour éviter le flash blanc au resize sur [WebKitGTK](../01-decouverte/glossaire.md#webkitgtk), les couleurs de fond sont aussi écrites en inline style sur `<html>` et `<body>` via `THEME_BG_MAP` (constants.ts:32-39).

## Pour aller plus loin

- Comment Muya est instancié et orchestré : [`integration-muya.md`](integration-muya.md).
- Les flux exacts (frappe, ouverture, sauvegarde, thème) : [`flux-de-donnees.md`](flux-de-donnees.md).
- Les commandes [IPC](../01-decouverte/glossaire.md#ipc) consommées par `fileOperations` et `preferences` : [`backend-rust.md`](backend-rust.md).
