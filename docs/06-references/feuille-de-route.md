# Feuille de route

> Ce document remplace l'ancien `ROADMAP.md` à la racine du projet. Il décrit ce qui est fait, ce qui est en cours, ce qui est prévu, en restant honnête sur l'avancement.
>
> Trois horizons : **court terme** (3-6 mois), **moyen terme** (6-12 mois), **long terme** (1+ an, voir [`perspectives.md`](perspectives.md)).
>
> Pour la liste détaillée des bugs ouverts, voir [`problemes-connus.md`](problemes-connus.md).

---

## Ce qui est fait

Les phases 0 à 5 du plan initial sont terminées. Pour mémoire :

- **Phase 0 — Assainissement** : nettoyage de `CLAUDE.md` et `Cargo.toml`.
- **Phase 1 — Éclatement des god components** : `Sidebar` (1286 lignes → 4 fichiers), `SettingsModal` (636 lignes → 6 fichiers), `+page.svelte` (560 → 444 lignes avec extraction du service `fileOperations`).
- **Phase 2 — Extractions depuis `MuyaPane`** : services `historyCache.ts` et `typewriterScroller.ts`.
- **Phase 3 — Backend Rust** : type d'erreur custom `AppError`, renommage `list_markdown_files` → `list_directory_entries`, 30 tests Rust.
- **Phase 4 — Améliorations structurelles** : types partagés (`editor.ts`, `filesystem.ts`), [i18n](../01-decouverte/glossaire.md) séparée par locale.
- **Phase 5 — Review sécurité/qualité** : 27 corrections (path traversal, [TOCTOU](../01-decouverte/glossaire.md), limites de taille, fuites mémoire de subscriptions, [a11y](../01-decouverte/glossaire.md), [CSP](../01-decouverte/glossaire.md) resserrée, backup préférences, [CI](../01-decouverte/glossaire.md) clippy + fmt).

Reste en suspens depuis ces phases :

- **Décider du sort de Muya** (vendored figé, [submodule](../01-decouverte/glossaire.md#git), ou paquet [npm](../01-decouverte/glossaire.md#npm)) — non tranché.
- **Sous-structs `Preferences` avec `#[serde(flatten)]`** — optionnel, pas prioritaire.

---

## Court terme (3-6 mois)

Priorité au **debug, à la fiabilité et à l'observabilité**. La plupart des chantiers ici visent à rendre les bugs visibles avant d'essayer de les corriger.

### Mode debug global

- État : **non commencé**, recommandé en priorité par l'audit.
- Objectif : un store `debugFlags` avec des flags par sujet (`autoSave`, `muya`, `tabSwitch`, `prefs`, `toc`). Chaque service consulte le flag pour décider d'écrire dans la console. Raccourci dev pour basculer un panneau de toggle.
- Pourquoi en premier : sans cette instrumentation, les bugs Ctrl+Z, autoSave et TOC restent difficiles à reproduire.

### Stabiliser undo/redo (Ctrl+Z)

- État : **bug ouvert**, voir [`problemes-connus.md`](problemes-connus.md#ctrlz-se-comporte-mal-au-changement-donglet).
- Travail attendu : audit de l'interaction `historyCache` ↔ historique interne Muya ↔ intercept Ctrl+Z capture phase ([WebKitGTK](../01-decouverte/glossaire.md#webkitgtk)). Tracer chaque appel `getHistory()` / `setHistory()`. Ajouter des tests d'intégration sur le scénario "tape, switch, switch back, undo".

### Rendre l'autoSave bavard en cas d'échec

- État : **bug ouvert**, voir [`problemes-connus.md`](problemes-connus.md#sauvegarde-silencieuse--pas-de-feedback-en-cas-déchec).
- Travail attendu : attendre la résolution de la promise [IPC](../01-decouverte/glossaire.md#ipc) avant de marquer l'onglet "saved". Toast d'erreur via `toastStore` en cas d'échec. Idempotence : pas d'écriture si `content === savedContent`. Optionnel : retry exponentiel pour les erreurs transitoires.

### Stabiliser la table des matières

- État : **bug ouvert**, voir [`problemes-connus.md`](problemes-connus.md#table-des-matières-instable--pas-toujours-fonctionnelle).
- Travail attendu : remplacer la regex naïve `^(#{1,6})\s+(.+)$` par un parsing [AST](../01-decouverte/glossaire.md#parser). Deux options à arbitrer :
  - a) Nouvelle commande IPC `extract_headings(markdown)` côté Rust (réutilise [comrak](../01-decouverte/glossaire.md#comrak)).
  - b) Lib JS dédiée côté frontend (coût bundle).

### Notifier les erreurs préférences

- État : **bug ouvert**, fix court (toast d'erreur explicite).
- Travail attendu : remplacer `.catch(...)` silencieux dans `preferences.patch()` par une notification toast.

### Toast pour l'erreur CLI

- État : non commencé, déjà listé dans l'ancienne roadmap.
- Travail attendu : afficher un toast quand le fichier passé en CLI échoue à l'ouverture (actuellement log console uniquement).

---

## Moyen terme (6-12 mois)

Priorité à la **robustesse structurelle** : tests E2E, schémas migrables, fiabilisation des fonctionnalités complexes (tableaux, mode split).

### Tests E2E

- État : **non commencé**. Mentionné dans la roadmap depuis le début, jamais implémenté.
- Travail attendu : setup `tauri-driver` + Playwright/WebDriver. Tests smoke du flux complet (ouvrir fichier, modifier, sauver, quitter, rouvrir). Cibler les scénarios fragiles identifiés dans l'audit (tab switching + undo, autoSave + erreur disque, mode split + frappe rapide).

### Migration de schéma préférences

- État : **non commencé** mais `prefs_version: u32` est déjà déclaré dans la struct.
- Travail attendu : implémenter `migrate_preferences(prefs)` qui inspecte `prefs_version` et applique des transformations idempotentes. À traiter **avant** le prochain changement breaking de schéma — sinon les utilisateurs perdront leurs settings.

### Fiabilisation des tableaux

- État : **bugs ouverts dans Muya**, voir [`problemes-connus.md`](problemes-connus.md#bugs-sur-les-tableaux). Dépend de Muya, pas de la couche MiraMD.
- Travail attendu : reproduire un cas minimal et vérifier si le bug existe déjà dans MarkText. Si oui, surveiller le repo Muya upstream et rapatrier les fixes manuellement (Muya est [vendored](../01-decouverte/glossaire.md#muya), pas synchronisé automatiquement).

### Désynchronisation source ↔ WYSIWYG en mode split

- État : **bug ouvert**, voir [`problemes-connus.md`](problemes-connus.md#désynchronisation-source--wysiwyg-en-mode-split).
- Travail attendu : ajouter une garde "écrivain actif" sur `SourcePane`. Réduire le [debounce](../01-decouverte/glossaire.md#debounce) ou passer à throttle. Test d'intégration dédié.

### Timeout sur les commandes IPC

- État : non commencé.
- Travail attendu : wrapper `invokeWithTimeout(cmd, args, ms)` côté frontend qui rejette après N secondes et affiche un toast. Évite les UI gelées sur des commandes Rust qui se figent.

### Améliorations DX et tests services

- Tests pour les services `fileOperations`, `editorModes`, `zoom`, `lineNumbers`, `typewriterScroller`.
- Réduire les `any` restants dans `muya.ts` via une interface `MuyaInstance` minimale typée.
- Typage fort des clés [i18n](../01-decouverte/glossaire.md#i18n) — extraire un type union de `fr.ts`, typer la fonction `tr()` pour détecter les typos à la compilation.

### Pagination et virtualisation

- Pagination : déjà supportée côté backend (`list_directory_entries(offset, limit)`). Reste à câbler côté frontend pour les très gros dossiers.
- Virtualisation : pas de virtualisation dans `TabBar` ni `FileTreePane`. Pas un problème pour l'usage courant, mais à prévoir si on cible des workspaces de 10k+ fichiers.

---

## Long terme (1+ an)

Voir [`perspectives.md`](perspectives.md) pour le détail. En résumé :

- **Sort de Muya** : décision pas encore prise. Le document [`vision_longterme.md`](perspectives.md) explore la piste Rust/[WASM](../01-decouverte/glossaire.md) + canvas (réécriture complète) mais conclut que ce n'est probablement pas la bonne direction. La voie réaliste est de stabiliser Muya plutôt que de le remplacer.
- **Plugins tiers** : pas de système d'extension à ce jour. Demanderait une [API](../01-decouverte/glossaire.md#api) stable côté Muya et un mécanisme d'isolation côté Tauri.
- **Sync multi-machines, collaboration** : exploratoire, sans engagement.
- **Auto-update Tauri** : configuré dans la roadmap initiale, non implémenté.
- **Signing automatisé** : non fait, signature manuelle à chaque release.

---

## Comment contribuer à cette feuille de route

- **Avant de commencer un chantier** : vérifier ici qu'il n'est pas déjà engagé, et lire l'entrée correspondante dans [`problemes-connus.md`](problemes-connus.md) si elle existe.
- **En cours de chantier** : marquer l'état "en cours" avec ton handle.
- **À la fin** : ne pas supprimer l'entrée, la déplacer en haut du document dans la section "Ce qui est fait" avec une date et un lien vers le commit ou la PR.
- **Si un chantier stagne** : le laisser là, ne pas réécrire pour faire bonne figure. La stagnation est une information utile.
