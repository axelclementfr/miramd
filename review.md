# Review Globale — MiraMD

**Date** : 2026-03-22 (post-corrections)
**Version** : 0.1.0
**Stack** : Tauri 2 (Rust) + Svelte 5 + Muya + Vite
**Statut** : `npm run check` 0 erreurs / 1 warning (drag-bar, par design), 164 tests frontend passent, 28 tests Rust passent, `cargo check` OK

---

## Résumé

Éditeur Markdown desktop réécriture de MarkText : ~5 MB / ~30 MB RAM contre ~200 MB / ~300 MB. Architecture propre, backend Rust solide (0 unsafe, sécurité filesystem bien traitée), frontend Svelte 5 bien découpé avec services extraits. CI multi-plateforme complète avec audit de sécurité.

Suite à la review, **11 corrections appliquées** : audit sécurité CI, filtrage extension CLI, 4 fixes a11y (TocPane, SearchPane, TabBar, CustomSelect), 7 catches vides remplacés par du logging, fire-and-forget preferences corrigé, messages FR hardcodés internationalisés, code mort Rust retiré, autoSave optimisé.

---

## 1. Architecture (8.5/10)

### ✅ Points forts
- **Backend Rust modulaire** : 5 modules à responsabilité unique (`lib.rs` setup/tray, `filesystem.rs`, `markdown.rs`, `preferences.rs`, `error.rs`)
- **Frontend bien découpé** : `+page.svelte` (256 lignes) est un orchestrateur léger, la logique est dans 9 services (`muya.ts`, `fileOperations.ts`, `shortcuts.ts`, `autoSave.ts`, `windowInit.ts`, `editorModes.ts`, `stats.ts`, `zoom.ts`, `lineNumbers.ts`, `typewriterScroller.ts`, `historyCache.ts`)
- **Singleton MuyaService** : encapsule toutes les interactions éditeur, pas d'accès direct au Muya instance depuis les composants
- **IPC typé** : `invoke<T>()` côté TS → `#[tauri::command]` → `Result<T, AppError>` via serde
- **Stores propres** : 3 stores Svelte (`editor`, `preferences`, `toast`) avec responsabilités distinctes, `activeTab` via `derived()`
- **Cache d'historique par onglet** : undo/redo préservé lors du changement d'onglet via `historyCache`
- **Constantes extraites** : `constants.ts` pour les magic numbers (sidebar width, min sizes, zoom, theme bg map)

### ⚠️ Points d'attention restants
- **Duplication confirmation unsaved** : logique save/discard/cancel dupliquée entre `TabBar.svelte`, `fileOperations.ts`, et `FileTreePane.svelte` — trois copies quasi identiques. Refactoring opportuniste quand pertinent.
- **Duplication `applyPrefs`** : le pattern `setAttribute('data-theme')` + `setProperty('--font-size')` est dupliqué entre `+page.svelte` et `SettingsModal.svelte`

**Priorité** : basse — refactoring quand opportun

---

## 2. Sécurité (9/10)

### ✅ Points forts
- **0 `unsafe` Rust** dans tout le backend
- **Path traversal protégé** : `sanitize_path()` et `sanitize_write_path()` rejettent `..`, canonicalisent, protection symlink
- **TOCTOU éliminé** : `create_file()` utilise `OpenOptions::create_new(true)` — atomique
- **Validation filename exhaustive** : rejette `/`, `\`, `..`, `.`, `\0`, caractères de contrôle — 7 tests dédiés
- **Limites de taille** : `read_file` → 50 MB, `parse_markdown` → 10 MB, vérifiées avant lecture/traitement
- **Markdown safe** : comrak avec `unsafe_ = false` — `<script>` strippé (test dédié)
- **Validation préférences** : `validate_preferences()` clamp toutes les valeurs numériques
- **CSP configurée** : `default-src 'self'`, `connect-src 'self'`
- **`debug_log` conditionné** : no-op en release via `#[cfg(debug_assertions)]`
- **Pas de `{@html}`** dans les composants Svelte — pas de risque XSS frontend
- **Audit de sécurité en CI** : `npm audit --audit-level=moderate` + `cargo audit` dans le pipeline, bloquant pour le build ✅ corrigé
- **Filtrage extension CLI** : `is_markdown_file()` vérifie l'extension (.md, .markdown, .mmd, .mdx, .mkd) avant ouverture via CLI ou single-instance ✅ corrigé

### ⚠️ Points d'attention restants
- **CSP `unsafe-eval`** dans `script-src` — nécessaire pour Muya (`eval()` pour syntax highlighting). Trade-off documenté dans CLAUDE.md, suppression prévue v2.0
- **`listIndentation: number | string`** en TS / `u32` en Rust — incohérence volontaire : Muya accepte `'dfm'` et `'tab'` comme valeurs, serde les sérialise correctement

---

## 3. Performance / Scalabilité (8.5/10)

### ✅ Points forts
- **Ratio excellent** : ~5 MB binaire, ~30 MB RAM
- **Debouncing systématique et cohérent** : content update 100ms, stats 300ms, TOC 300ms, prefs save 200ms, source→Muya sync 400ms
- **Throttle typewriter** : 50ms + `requestAnimationFrame` — pas de layout thrashing
- **Pagination backend** : `list_directory_entries()` supporte offset/limit
- **Lazy imports Tauri** : `await import('@tauri-apps/api/window')` dans `toggleSidebar()` et `windowInit.ts`
- **Timer cross-tab pollution prévenue** : `MuyaPane.svelte` clear les timers avant changement d'onglet
- **Code mort retiré** : `get_document_stats` et `DocumentStats` supprimés du backend Rust (les stats sont calculées localement dans `stats.ts` avec support CJK) ✅ corrigé
- **autoSave optimisé** : le polling de détection de changement de config passe de 1s à 2s, et le save interval tourne directement au délai configuré au lieu de re-checker chaque seconde ✅ corrigé

### ⚠️ Points d'attention restants
- **I/O bloquant** : toutes les opérations filesystem sont synchrones côté Rust — acceptable pour un éditeur mais un fichier de 50 MB bloquera l'event loop
- **Pas de virtualisation** : la TabBar et le FileTreePane rendent tous les éléments dans le DOM

**Priorité** : basse — impact négligeable actuellement

---

## 4. Données / Persistance (9/10)

### ✅ Points forts
- **XDG-compliant** : `~/.config/miramd/preferences.json` via `dirs::config_dir()`
- **Rétrocompatibilité** : `#[serde(default)]` sur chaque champ + `#[serde(rename_all = "camelCase")]`
- **Forward-compatible** : test `serde_unknown_fields_ignored` vérifie que les champs inconnus ne cassent rien
- **Backup automatique** : `.json.bak` avant chaque écriture
- **Fallback gracieux en cascade** : `dirs::config_dir()` → `home_dir/.config` → `/tmp`
- **JSON corrompu → défauts** : pas de crash, log warning et recréation
- **`prefsVersion: u32`** : champ prêt pour les futures migrations
- **`preferences.patch()` avec error handling** : `.catch()` ajouté sur l'`invoke()` — erreur de sauvegarde loguée au lieu d'être silencieuse ✅ corrigé

### ⚠️ Points d'attention restants
- **Migration non implémentée** : `prefs_version` est déclaré (default = 1) mais jamais vérifié — un changement de schéma breaking utilisera silencieusement les défauts

**Priorité** : moyenne — à implémenter avant tout changement de schéma

---

## 5. Gestion d'erreurs / Fiabilité (8/10)

### ✅ Points forts
- **`AppError` enum** avec 7 variantes + `thiserror` + `#[from]` — bon pattern Rust
- **Propagation via `?`** partout dans le backend, pas de `unwrap()` dans le code IPC
- **Toast notifications** avec `aria-live="polite"` pour les erreurs utilisateur
- **`beforeunload`** confirmation si modifications non sauvegardées
- **Muya wrapping** : toutes les méthodes du service ont `try/catch` avec `console.debug('[Muya]', e)`
- **7 catches vides remplacés par du logging** — `console.warn` pour les 2 critiques (editorModes blur, MuyaPane markSaved), `console.debug` pour les 5 non-critiques (windowInit, +page sidebar, MuyaPane getHistory, SourcePane split sync, FileTreePane icons) ✅ corrigé

### ⚠️ Points d'attention restants
- **Toast auto-dismiss 5s** : un échec de sauvegarde critique disparaît en 5 secondes
- **Pas d'error boundary** : une exception dans un composant Svelte crash toute l'app (limitation Svelte 5)
- **`.flatten()` dans `list_directory_entries`** (`filesystem.rs:146`) : les entrées de répertoire en erreur sont ignorées sans log

**Priorité** : basse

---

## 6. Maintenabilité (8.5/10)

### ✅ Points forts
- **Organisation par domaine** : `components/editor/`, `components/settings/`, `components/sidebar/`
- **Types dédiés** dans `src/lib/types/` (`editor.ts`, `filesystem.ts`, `muya-instance.d.ts`)
- **i18n complet** : 8 langues (FR, EN, ES, DE, IT, PT, JA, ZH) avec type `TranslationKey` exporté depuis `fr.ts`
- **CLAUDE.md détaillé** : architecture, commandes, décisions de design, CSP rationale
- **Pre-commit hooks** : Husky + lint-staged (Biome pour TS/JS, `cargo fmt` pour Rust)
- **Biome** : linter + formatter unifié, bien configuré (120 chars, tabs, single quotes)
- **Messages i18n cohérents** : les messages FR hardcodés dans `FileTreePane.svelte` remplacés par `tr()` ✅ corrigé

### ⚠️ Points d'attention restants
- **`any` inévitables** : `muyaInstance: writable<any>`, `ChangeCallback = (changes: any) => void`, `appWindow: any` — lié à Muya (JS externe non typé)
- **Pas de pluralisation i18n** : "1 words" affiché au lieu de "1 word"

**Priorité** : basse

---

## 7. Frontend (8.5/10)

### ✅ Points forts
- **Svelte 5 runes** utilisées correctement : `$state`, `$props`, `$derived`, `onMount`/`onDestroy`
- **Lifecycle propre** : pattern `unsubs[]` + `onDestroy(() => unsubs.forEach(u => u()))` systématique
- **6 thèmes CSS** via `[data-theme]` avec variables CSS, + synchronisation Muya via MutationObserver
- **Modes d'édition complets** : WYSIWYG, source, split, read-only, focus, typewriter — machine d'état dans `editorModes.ts`
- **CustomSelect** avec ARIA complet : `aria-controls`, `aria-expanded` sur le combobox, `id` sur le listbox ✅ corrigé
- **Loading state** : barre animée lors du changement d'onglet (`EditorContainer.svelte`)
- **Animations Svelte** : transitions `fly`, `slide`, `fade` bien dosées
- **TocPane** : bouton-dans-bouton corrigé — outer element est un `<div role="button">` avec keyboard handler, inner `<button>` pour le toggle ✅ corrigé
- **SearchPane** : 3 contrôles (case sensitive, whole word, regex) et résultats de recherche convertis de `<span>/<div>` en `<button>` — 10 `svelte-ignore a11y_*` supprimés ✅ corrigé
- **TabBar** : handler clavier (Enter/Space) ajouté sur les onglets `<li>` ✅ corrigé

### ⚠️ Points d'attention restants
- **1 warning a11y** : `Sidebar.svelte:129` — `<div>` non-interactif avec `onmousedown` (drag bar). Le `role="separator"` est sémantiquement correct mais Svelte ne le reconnaît pas comme interactif. Warning cosmétique par design.

---

## 8. Backend Rust (9/10)

### ✅ Points forts
- **0 `unsafe`**, 0 `unwrap()` dans le code IPC
- **28 tests unitaires** couvrant : path traversal, filename validation (null bytes, control chars, backslash, dot), création atomique, pagination, roundtrip lecture/écriture, serde forward/backward compat, validation des clamps
- **Gestion d'erreur exemplaire** : `AppError` avec 7 variantes, `thiserror`, `#[from]`, propagation `?`, sérialisation pour IPC
- **Sécurité filesystem solide** : canonicalisation, validation, limites de taille, backup
- **Dépendances minimales** : 11 crates
- **Logging structuré** : `log` + `env_logger`, levels appropriés (info/warn/debug)
- **Filtrage extension CLI** : `is_markdown_file()` empêche l'ouverture de fichiers non-markdown via CLI ou single-instance ✅ corrigé
- **Code mort nettoyé** : `get_document_stats` et `DocumentStats` retirés (inutilisés côté frontend) ✅ corrigé

### ⚠️ Point mineur restant
- **`.flatten()` silencieux** (`filesystem.rs:146`) : entrées de répertoire en erreur ignorées sans log

---

## 9. Tests / Observabilité (7.5/10)

### ✅ Points forts
- **13 fichiers de tests**, 1842 lignes de test total
- **Tests d'intégration** : `features.test.ts`, `full-app.test.ts`, `keyboard.test.ts`, `regression.test.ts`
- **Tests de services** : `editorModes`, `fileOperations`, `lineNumbers`, `stats`, `typewriterScroller`, `zoom`
- **Tests de stores** : `editor`, `preferences`, `toast`
- **28 tests Rust** couvrant sécurité, serde, validation
- **CI avec couverture** : lcov (frontend via vitest) + tarpaulin/cobertura (Rust) en artefacts
- **Mocks Tauri** fonctionnels dans les tests

### ⚠️ Points d'attention restants
- **Pas de seuil de couverture** : aucun gate dans la CI
- **Pas de tests E2E** : aucun test Tauri/WebDriver
- **Pas de test pour `autoSave.ts`** ni `historyCache.ts`
- **Pas de métriques runtime** ni de crash reporting

**Priorité** : basse

---

## 10. Déploiement / Ops (9/10)

### ✅ Points forts
- **CI complète et bien structurée** : 6 jobs (check, test-frontend, rust-lint, test-rust, security-audit, build 3 plateformes) avec `needs:`
- **Audit de sécurité en CI** : `npm audit --audit-level=moderate` + `cargo audit` — bloquant pour le build ✅ corrigé
- **Build multi-plateforme** : Linux (.deb, .AppImage), macOS (.dmg), Windows (.msi, .exe)
- **Release automatisé** : tag `v*` → build 3 OS → draft GitHub Release avec notes auto-générées
- **Rust cache** : `Swatinem/rust-cache@v2` — builds CI accélérés
- **File associations** : .md, .markdown, .mmd, .mdx, .mkd
- **Single-instance** + tray icon (stay resident)

### ⚠️ Points d'attention restants
- **Pas de Dependabot/Renovate** : mises à jour de dépendances manuelles
- **Pas de Tauri updater** configuré : pas de mise à jour automatique in-app
- **Release workflow ne lance pas les tests** : il build directement sans re-tester

**Priorité** : basse

---

## 11. DX — Developer Experience (9/10)

### ✅ Points forts
- **Scripts npm complets** : dev, build, check, check:watch, lint, lint:fix, format, test, test:watch, test:coverage
- **Hot reload** : Vite HMR + Tauri dev watch
- **Pre-commit** : Husky + lint-staged (Biome + cargo fmt)
- **`cargo clippy -D warnings`** + `cargo fmt --check` en CI, bloquants
- **CLAUDE.md** : documentation d'architecture exhaustive
- **TypeScript strict** avec exclusion Muya (`tsconfig.json`)
- **Biome** : rapide, remplace ESLint + Prettier en un seul outil

---

## Synthèse

### Score : 8.5 / 10

| Section | Note | Résumé |
|---------|------|--------|
| Architecture | ✅ 8.5 | Bien découpé, services extraits, duplication modérée |
| Sécurité | ✅ 9 | 0 unsafe, audit CI, filtrage CLI, path traversal, TOCTOU éliminé |
| Performance | ✅ 8.5 | Ratio excellent, debouncing cohérent, code mort nettoyé, autoSave optimisé |
| Données | ✅ 9 | XDG, backup, fallback, forward-compat, error handling sur patch() |
| Erreurs | ✅ 8 | AppError solide, 7 catches vides corrigés, logging structuré |
| Maintenabilité | ✅ 8.5 | Bonne orga, i18n cohérent, messages FR corrigés |
| Frontend | ✅ 8.5 | Svelte 5 bien utilisé, a11y corrigé (4 warnings → 1 cosmétique) |
| Backend Rust | ✅ 9 | Exemplaire — 0 unsafe, 28 tests, filtrage CLI, code mort nettoyé |
| Tests | ⚠️ 7.5 | 13 fichiers, bonne couverture, pas de seuil, pas d'E2E |
| Déploiement | ✅ 9 | CI multi-plateforme + audit sécurité, release auto |
| DX | ✅ 9 | Outillage complet, pre-commit, doc riche |

---

### Corrections appliquées (11 points)

| # | Correction | Chantier |
|---|-----------|----------|
| 1 | `npm audit` + `cargo audit` ajoutés en CI (job `security-audit`, bloquant pour le build) | CI/Sécurité |
| 2 | Filtrage extension markdown dans CLI + single-instance (`is_markdown_file()` dans `lib.rs`) | CI/Sécurité |
| 3 | `TocPane.svelte` : button-dans-button → `<div role="button">` + `<button>` séparés | A11y |
| 4 | `SearchPane.svelte` : 3 `<span onclick>` + résultats `<div>` → `<button>`, 10 `svelte-ignore` supprimés | A11y |
| 5 | `TabBar.svelte` : handler clavier (Enter/Space) ajouté sur les onglets `<li>` | A11y |
| 6 | `CustomSelect.svelte` : `aria-controls` + `aria-expanded` ajoutés sur le combobox | A11y |
| 7 | 7 catches vides → logging (`console.warn` pour les 2 critiques, `console.debug` pour les 5 autres) | Erreurs |
| 8 | `preferences.patch()` : `.catch()` ajouté sur l'`invoke()` fire-and-forget | Erreurs |
| 9 | `FileTreePane.svelte` : messages FR hardcodés remplacés par `tr()` | i18n |
| 10 | `get_document_stats` + `DocumentStats` retirés du backend Rust (code mort) | Performance |
| 11 | `autoSave.ts` : polling optimisé (1s → 2s check, interval au délai configuré) | Performance |

---

### Améliorations restantes (priorité basse)

| # | Action | Effort |
|---|--------|--------|
| 1 | Extraire la logique unsaved confirm en fonction partagée dans `fileOperations.ts` | Moyen |
| 2 | Implémenter la migration de préférences (utiliser `prefs_version`) | Moyen |
| 3 | Ajouter des tests pour `autoSave.ts` et `historyCache.ts` | Faible |
| 4 | Configurer Dependabot/Renovate pour les mises à jour automatiques | Faible |
| 5 | Ajouter un seuil de couverture en CI | Faible |

---

### Verdict

> **MiraMD est un projet solide, bien sécurisé et bien testé — prêt pour une release alpha.** Le score passe de 8/10 à 8.5/10 après les 11 corrections : audit sécurité en CI, filtrage CLI, a11y (4 warnings → 1 cosmétique), catches vides tous loggés, i18n cohérent, code mort nettoyé. Les points restants sont tous de priorité basse et n'impactent pas la stabilité ou la sécurité.
