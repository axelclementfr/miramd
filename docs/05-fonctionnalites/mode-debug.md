# Mode debug

## Vue utilisateur

Le mode debug n'est pas exposé dans Settings — c'est volontaire. Il sert au développement, pas à l'utilisation quotidienne. Deux façons de l'activer :

1. **Au boot, pour reproduire un bug avec une trace dès la première frame** : ouvrir DevTools (Ctrl+Shift+I dans le binaire de dev), aller dans l'onglet Console, taper `localStorage.setItem('miramd_debug', 'typewriter,ctrlz')`, recharger la fenêtre.
2. **À chaud, pendant qu'on debug** : `Ctrl+Shift+D` ouvre un petit panneau flottant en haut à droite. Cocher/décocher chaque sujet active immédiatement les logs correspondants.

Quand au moins un sujet est actif, un badge orange `DEBUG: ...` apparaît à droite de la status bar. Cliquer sur le badge rouvre le panneau. Le bouton "Disable all" du panneau coupe tout d'un coup.

## Sujets disponibles

| Sujet | Couvre |
|---|---|
| `typewriter` | Mode machine à écrire — calcul de padding et offset, re-centrage. |
| `ctrlz` | Cache d'historique par onglet, snapshots, intercept Ctrl+Z. |
| `save` | Sauvegardes auto et manuelles, écriture fichier, backup `.bak`. |
| `muya` | Wrapper du service Muya — destroy, getMarkdown, setMarkdown, undo, redo, focus, etc. |
| `zoom` | Zoom natif WebKit, slider, indicateur status bar, Ctrl+molette. |
| `editorModes` | Bascule des modes (focus, source, typewriter, lecture seule). |
| `prefs` | Lecture/écriture du fichier de préférences via IPC Rust. |
| `sound` | Synthèse et lecture des sons de la machine à écrire. |
| `toc` | Extraction et navigation TOC — pourquoi un clic ne navigue pas, quel pos a été demandé, etc. |

À ce jour, les sujets `muya` (20 appels), `sound` (2 appels), `ctrlz` (8 appels) et `toc` (4 appels) ont des points d'instrumentation. Les autres sujets sont déclarés et fonctionnels mais pas encore utilisés — ils sont prêts à recevoir des `dlog()` au fur et à mesure qu'on attaque les bugs correspondants.

Ajouter un nouveau sujet : éditer `src/lib/stores/debug.ts`, ajouter une ligne dans le type `DebugSubject` et dans `ALL_SUBJECTS`. Le panneau l'affichera automatiquement.

## Implémentation

Trois fichiers font tout :

- `src/lib/stores/debug.ts` — déclare le type `DebugSubject`, le tableau `ALL_SUBJECTS`, le [store](../01-decouverte/glossaire.md#store-svelte) `debugFlags` (writable Svelte), et les helpers `hydrateFromStorage` / `persistFlags`. Hydrate au boot depuis `localStorage.miramd_debug` (chaîne de sujets séparés par virgules). Les accès `localStorage` sont protégés par `try/catch` pour qu'une erreur (quota, storage désactivé) ne fasse pas planter l'app.
- `src/lib/services/debug.ts` — expose `dlog(subject, ...args)` qui no-op si le flag du sujet est `false`, sinon appelle `console.log` avec le préfixe `[subject]`. Expose aussi `setDebugFlag(subject, enabled)` (met à jour le store + persiste) et `setupDebugShortcut()` (raccourci `Ctrl+Shift+D` qui toggle l'ouverture du panneau).
- `src/lib/components/DebugPanel.svelte` — panneau flottant (`position: fixed`, top-right). Itère sur `ALL_SUBJECTS` pour générer les checkboxes. Affiché conditionnellement via le store `debugPanelOpen`.

L'intégration dans `src/routes/+page.svelte` se fait en quelques lignes (imports, montage du composant et appel de `setupDebugShortcut` au boot). Le badge dans `src/lib/components/StatusBar.svelte` souscrit à `debugFlags` et affiche les sujets actifs.

## Conséquence : les catch blocks Muya sont silencieux par défaut

La refonte a converti 22 `console.debug` en `dlog()`, dont la plupart sont dans les catch blocks de `src/lib/services/muya.ts` (chaque méthode du wrapper [Muya](../01-decouverte/glossaire.md#muya) est encadrée par `try { ... } catch (e) { dlog('muya', '...:', e); }`). Avant, si Muya levait une exception (quelque chose comme `setMarkdown` qui plante sur un markdown malformé), elle apparaissait spontanément dans DevTools. Maintenant, **elle est silencieuse tant que `muya` n'est pas activé**.

C'est intentionnel — les flags par défaut produisent une console propre en production — mais ça a une conséquence pratique : **si tu rapportes un bug lié à l'éditeur Muya, active d'abord le sujet `muya`** (`localStorage.setItem('miramd_debug', 'muya')` puis reload, ou Ctrl+Shift+D et coche `muya`) pour que les exceptions internes apparaissent dans DevTools avant de reproduire le problème.

## Exclusions documentées

Trois `console.debug` ont été laissés intacts (non migrés vers `dlog`) parce qu'ils ne correspondent à aucun sujet du registre :

| Ligne | Justification |
|---|---|
| `src/routes/+page.svelte:171` (`[Sidebar] resize:`) | Plumbing UI sidebar, pas un sujet métier. |
| `src/lib/components/sidebar/FileTreePane.svelte:134` (`[FileTree] icon:`) | Erreur du lookup d'icône, sujet trop périphérique. |
| `src/lib/services/windowInit.ts:42` (`[WindowInit] setMinSize:`) | Régression Tauri API, sujet trop bas niveau. |

Ces trois cas restent en `console.debug` (= toujours visibles dans DevTools mais discrets). **Si une future passe de migration les balaye sans réfléchir, on perdra le signal silencieusement.** À chaque fois qu'un nouveau sujet apparaît dans `DebugSubject`, repasser sur cette liste pour voir si l'un d'eux peut maintenant être migré.

## Pourquoi pas dans Settings

Les Settings sont pour les utilisateurs. Le mode debug est pour les développeurs qui chassent un bug. Le mettre dans Settings ajoute du bruit pour 99% des cas d'usage. La convention pro (Chrome DevTools, React DevTools, Vue DevTools) est exactement la même : caché derrière un raccourci ou un flag dans le storage.

## Pourquoi pas de mode "verbose" / "trace" / "info"

Un seul niveau on/off par sujet suffit pour les bugs identifiés. Si on a besoin de gradations un jour, on pourra ajouter `dlog.verbose(...)` sans rien casser. YAGNI pour l'instant.

## Coût performance de `dlog`

Chaque appel à `dlog()` fait un `get(debugFlags)` (subscribe + unsubscribe synchrone), même quand le flag est `false`. C'est cheap mais pas gratuit. À éviter dans une hot path par-frappe ou par-changement-de-sélection. Init, tab-switch, et timers debouncés sont OK. Voir la JSDoc de `dlog` pour la note complète.

## Voir aussi

- [`docs/superpowers/specs/2026-05-09-mode-debug-design.md`](../superpowers/specs/2026-05-09-mode-debug-design.md) — spec d'origine avec les arguments pour chaque choix architectural.
- [`docs/superpowers/plans/2026-05-09-mode-debug.md`](../superpowers/plans/2026-05-09-mode-debug.md) — plan d'implémentation détaillé en 5 tâches TDD.
- [`docs/06-references/problemes-connus.md`](../06-references/problemes-connus.md) — section "Résolus" pour l'historique du bug structurel "pas de mode debug global".
