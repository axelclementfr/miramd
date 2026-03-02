# ROADMAP — MiraMD

## Phase 0 — Assainissement ✅
- [x] Corriger CLAUDE.md : retirer les références TipTap, documenter Muya
- [x] Nettoyer Cargo.toml : thiserror conservé, utilisé en Phase 3
- [ ] Décider du sort de Muya (gitignore + script, ou submodule) — à traiter plus tard

## Phase 1 — Éclater les god components ✅

### 1.1 Sidebar (1286 lignes → 4 fichiers) ✅
- [x] Créer `src/lib/components/sidebar/Sidebar.svelte` (shell ~130 lignes)
- [x] Extraire `FileTreePane.svelte` (~350 lignes)
- [x] Extraire `SearchPane.svelte` (~250 lignes)
- [x] Extraire `TocPane.svelte` (~160 lignes)
- [x] Resize intégré dans le shell Sidebar (trop petit pour un composant séparé)
- [x] Supprimer l'ancien `Sidebar.svelte`
- [x] Type check : 0 erreurs

### 1.2 SettingsModal (636 lignes → 6 fichiers) ✅
- [x] Créer `src/lib/components/settings/SettingsModal.svelte` (shell avec tabs)
- [x] Extraire `ThemeSection.svelte`
- [x] Extraire `GeneralSection.svelte`
- [x] Extraire `EditorSection.svelte`
- [x] Extraire `ViewSection.svelte`
- [x] Extraire `MarkdownSection.svelte`
- [x] Supprimer l'ancien `SettingsModal.svelte`
- [x] Type check : 0 erreurs

### 1.3 +page.svelte (560 → 444 lignes) ✅
- [x] Créer `src/lib/services/fileOperations.ts` (openFileDialog, saveCurrentFile, closeTabWithConfirm, openFileFromPath)
- [x] Réduire +page.svelte en déléguant au service
- [x] Type check : 0 erreurs

## Phase 2 — Extractions depuis MuyaPane (240 → 203 lignes) ✅
- [x] Créer `src/lib/services/historyCache.ts`
- [x] Créer `src/lib/services/typewriterScroller.ts`
- [x] Type check : 0 erreurs

## Phase 3 — Backend Rust ✅
- [x] Créer `src-tauri/src/error.rs` avec thiserror (AppError enum + ContentTooLarge)
- [x] Remplacer tous les `Result<T, String>` par `Result<T, AppError>` dans filesystem.rs et preferences.rs
- [x] Renommer `list_markdown_files` → `list_directory_entries` (backend + frontend)
- [x] 30 tests Rust passent
- [ ] (Optionnel) Grouper les champs de Preferences en sous-structs avec `#[serde(flatten)]`

## Phase 4 — Améliorations structurelles ✅
- [x] Créer `src/lib/types/editor.ts` (Tab, DocumentStats, TocEntry)
- [x] Créer `src/lib/types/filesystem.ts` (FileEntry, FolderNode, OpenedProject)
- [x] Séparer i18n par locale (`src/lib/i18n/locales/{fr,en,es,de,it,pt,ja,zh}.ts`)
- [x] Type check : 0 erreurs

## Phase 5 — Review & corrections sécurité/qualité ✅ (27 points)
- [x] `sanitize_write_path()` canonicalisé (symlink attack)
- [x] `create_file()` atomique via `OpenOptions::create_new(true)` (TOCTOU)
- [x] Limite taille fichier 50 MB sur `read_file()`
- [x] Limite 10 MB sur `parse_markdown()` / `get_document_stats()` → `Result<T, AppError>`
- [x] `unwrap()`/`expect()` remplacés par error handling propre au démarrage
- [x] Subscriptions stores trackées dans `unsubs[]` + `onDestroy` (fuites mémoire)
- [x] `window.addEventListener` au lieu de `window.onkeydown =`
- [x] `debug_log` no-op en release (`#[cfg(debug_assertions)]`)
- [x] Logs sans chemins complets (nom de fichier uniquement)
- [x] `let _ =` window ops → logging debug
- [x] `subscribe()()` → `get()` partout
- [x] Regex heading cachée en constante module-level
- [x] Guard anti-doublons `removeReadOnlyHandlers()` dans editorModes
- [x] `list_indentation` typé `u32`
- [x] `prefs_path()` fallback amélioré (plus de `.`)
- [x] Catches vides `muya.ts` → `console.debug('[Muya]', e)`
- [x] Toast colors via CSS variables + dark theme `--danger`/`--success`
- [x] CustomSelect ARIA + navigation clavier
- [x] CSP resserrée (`default-src` sans `unsafe-eval`, `connect-src 'self'`)
- [x] `sidebar` typé `Sidebar | null`
- [x] A11Y TabBar (subscriptions + boutons sémantiques)
- [x] A11Y Sidebar (`<li onclick>` → `<button>`)
- [x] A11Y FileTreePane (éléments interactifs → `<button>`, `role="option"`)
- [x] A11Y TocPane (div → `<button>`)
- [x] Backup préférences (`preferences.json.bak`) + champ `prefsVersion: u32`
- [x] CI : `cargo clippy -D warnings` + `cargo fmt --check` (job `rust-lint`)
- [x] 8 tests Rust supplémentaires (edge cases sécurité)

---

## Phase 6 — Améliorations à venir

### 6.1 Architecture / Refactoring
- [ ] **Extraire les raccourcis clavier** de `+page.svelte` dans `src/lib/services/shortcuts.ts`
- [ ] **Extraire les constantes de layout** (`SIDEBAR_WIDTH`, `MIN_WIDTH`, `MIN_HEIGHT`) dans `src/lib/constants.ts`
- [ ] **Extraire l'auto-save** de `+page.svelte` dans un service dédié
- [ ] **Extraire l'init window** (min-size dynamique, maximized state) de `+page.svelte`
- [ ] (Optionnel) Grouper les champs Preferences en sous-structs avec `#[serde(flatten)]`
- [ ] Décider du sort de Muya (gitignore + script build, ou git submodule, ou npm package)

### 6.2 Sécurité
- [ ] **Documenter la nécessité de `unsafe-eval`** dans CLAUDE.md (Muya utilise `eval()` pour le rendu des code blocks)
- [ ] **Scoper les permissions filesystem** — remplacer `fs:default` par `fs:scope` avec chemins explicites dans `capabilities/default.json`

### 6.3 Performance
- [ ] **Debouncer l'extraction TOC** — `extractHeadings()` est appelé à chaque frappe sans debounce dans `editor.ts`
- [ ] **Pagination du listing répertoire** — limiter à N entrées par appel dans `list_directory_entries()`
- [ ] **Virtualisation sidebar** — composant de liste virtuelle pour les très gros dossiers (10k+ fichiers)

### 6.4 Gestion d'erreurs / UX
- [ ] **Toast pour l'erreur CLI** — afficher un toast quand le fichier passé en CLI échoue à l'ouverture (actuellement log console uniquement)
- [ ] **Toasts pour plus de cas d'erreur invoke()** — certaines erreurs backend ne remontent pas à l'utilisateur

### 6.5 Maintenabilité
- [ ] **Typage fort des clés i18n** — extraire un type union de `fr.ts`, typer la fonction `tr()` pour détecter les typos à la compilation
- [ ] **Réduire les `any` restants dans `muya.ts`** — créer une interface `MuyaInstance` minimale basée sur l'API utilisée
- [ ] **Ajouter des JSDoc** sur les fonctions publiques des services (`fileOperations`, `editorModes`, `muya`, etc.)

### 6.6 Frontend / A11Y
- [ ] **Résoudre les 14 warnings a11y restants** — ajouter `role="presentation"` aux resize edges/corners et zones de drag dans `+page.svelte` et `Sidebar.svelte`
- [ ] **Skeleton/loading states** — ajouter des états de chargement visuels (ouverture fichier, chargement dossier)

### 6.7 Testing / Observabilité
- [ ] **Tests services frontend** — ajouter `tests/services/fileOperations.test.ts` (open/save/close flow mockés)
- [ ] **Tests E2E** — setup `tauri-driver` + WebDriver/Playwright pour test smoke du flux complet
- [ ] **Coverage report** — ajouter `vitest --coverage` et/ou `cargo-tarpaulin` en CI
- [ ] **Tests services supplémentaires** — `editorModes`, `zoom`, `lineNumbers`, `typewriterScroller`

### 6.8 DX (Developer Experience)
- [ ] **Biome** (linter + formatter JS/TS) — installer, configurer, ajouter en CI
- [ ] **Pre-commit hooks** — husky + lint-staged pour enforcer format/lint avant chaque commit
- [ ] **`npm run lint` séparé** — pointer vers Biome au lieu d'être un alias de `svelte-check`

### 6.9 Déploiement / Ops
- [ ] **Builds cross-platform** — ajouter macOS et Windows dans la CI matrix
- [ ] **Signature de code** — signer les packages .deb/.AppImage/.dmg/.msi
- [ ] **Auto-update** — configurer le plugin Tauri updater
- [ ] **Release notes automatiques** — générer un changelog depuis les commits/PRs
