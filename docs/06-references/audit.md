# Audit complet — MiraMD

**Date** : 2026-04-29
**Version analysée** : 0.1.0
**Stack** : Tauri 2 (Rust) · Svelte 5 · Muya (vendored, chargé en `window.Muya`) · Vite 6 · Biome 2 · comrak 0.36

> Cet audit remplace l'ancien `review.md`. Il est basé sur une analyse profonde du code (5 rapports d'analyse parallèles couvrant backend Rust, services frontend, composants Svelte, intégration Muya, build/tests/CI).

---

## Résumé exécutif

MiraMD est une réécriture moderne et bien architecturée de MarkText. Le backend Rust est minimaliste, sûr (path traversal protégé, limites de taille, comrak avec `unsafe_=false`), et bien testé (28 tests). Le frontend Svelte 5 est découpé proprement en services singletons et stores, avec un seul point d'accès à Muya (`MuyaService`). Le pipeline CI/CD est complet : 7 jobs en parallèle, audit sécurité bloquant, builds multi-OS.

Le projet est cependant **alpha en termes de stabilité** : plusieurs bugs fonctionnels touchent l'expérience utilisateur (undo/redo, sauvegarde, table des matières), principalement dans la **couche d'intégration custom** entre Muya et l'orchestration Svelte. Le moteur Muya lui-même reste celui de MarkText (vendored), donc les fonctionnalités d'édition héritent de sa maturité, mais aussi de ses limites.

---

## 1. Architecture (8.5 / 10)

### Forces
- **Trois couches nettement séparées** : UI Svelte (composants + stores), moteur Muya (vendored), backend Rust (Tauri).
- **MuyaService = passerelle unique** vers l'instance Muya (singleton, encapsule tous les appels). Aucun composant Svelte ne touche Muya directement.
- **Backend Rust à responsabilité claire** : 5 modules (`lib.rs`, `error.rs`, `filesystem.rs`, `markdown.rs`, `preferences.rs`), aucun module > 250 lignes.
- **9 commandes IPC** bien typées, retours `Result<T, AppError>` sérialisés en string.
- **Pattern services singletons** côté frontend : ~11 services (muya, autoSave, fileOperations, shortcuts, editorModes, zoom, lineNumbers, typewriterScroller, windowInit, stats, historyCache).
- **Stores Svelte cohérents** : `editor` (tabs + activeTab + stats + toc), `preferences`, `toast`, `muyaInstance`.

### Friction
- **Muya chargé en script global `window.Muya`** depuis `static/muya/index.min.js` (pas de bundle Vite). Choix justifié par la nature vendored, mais le couple `window.Muya` + intégration TypeScript via `(window as any).Muya` réduit la sûreté de typage.
- **Pas de bus d'événements** au niveau frontend : la coordination entre services passe par les stores. C'est correct mais peut devenir confus quand plusieurs services lisent/écrivent le même store.
- **Code dupliqué** : `is_markdown_file()` validé deux fois côté CLI (setup + single-instance) dans `lib.rs`.

---

## 2. Sécurité (9 / 10)

### Forces (vérifiées dans le code)
- **Path traversal**, deux mécanismes :
  - `sanitize_path()` (filesystem.rs:19-32) — rejette `..`, canonicalize complet
  - `sanitize_write_path()` (filesystem.rs:36-58) — canonicalize parent, join filename brut
- **Filename validation** (filesystem.rs:102-110) — rejette `/`, `\`, `..`, `.`, null bytes, contrôle.
- **TOCTOU éliminé** : `OpenOptions::create_new(true)` pour `create_file` (filesystem.rs:116-127).
- **Limites de taille** : `MAX_READ_SIZE = 50 MB`, `MAX_PARSE_SIZE = 10 MB` (vérifiées par metadata avant lecture).
- **XSS dans rendu HTML** : comrak avec `options.render.unsafe_ = false` (markdown.rs:27) — `<script>` strippés.
- **Validation des préférences** : `validate_preferences()` clamp 9 champs numériques (8-72px fonts, 0.5-3.0× zoom, etc.).
- **CSP** dans `tauri.conf.json` : `default-src 'self'`, `connect-src 'self'`, restrictions sur `script-src`.
- **Capabilities Tauri restreintes** : seuls `core`, `event`, `window`, `opener`, `dialog` sont accordés. Pas de scope FS — le frontend doit invoquer les commandes Rust qui valident.
- **Pas de `{@html}`** dans aucun composant Svelte (vérifié).
- **Audit CI bloquant** : `npm audit --audit-level=moderate` + `cargo audit`, niveau bloquant.

### Bémols
- **`script-src 'unsafe-eval'`** dans la CSP : nécessaire pour Muya (utilisé pour la coloration syntaxique). Documenté comme dette technique. Suppression prévue à terme (sortie de Muya = sortie de `unsafe-eval`).
- **Pas de timeout côté IPC** : une commande très lourde peut figer l'UI (mais les limites de taille atténuent).

---

## 3. Performance / Scalabilité (8 / 10)

### Forces
- **Footprint exceptionnel** : ~5 MB de binaire, ~30 MB de RAM (vs ~200 MB / 300 MB pour MarkText).
- **Debouncing systématique** : content update 100 ms, stats 300 ms, TOC 300 ms, prefs save 200 ms, source→Muya sync 400 ms.
- **Throttle typewriter** : 50 ms via `requestAnimationFrame` — pas de layout thrashing.
- **Pagination backend** : `list_directory_entries(offset, limit)` supporte le découpage.
- **Lazy imports Tauri** : `await import('@tauri-apps/api/window')` dans `windowInit.ts`.
- **Cleanup des timers** : `contentTimer`, `statsTimer` annulés au changement d'onglet et au démontage.

### Friction
- **I/O Rust synchrone** : `read_file`, `write_file`, `create_file`, `list_directory_entries` sont tous synchrones. Acceptable pour un éditeur, mais un fichier de 50 MB ou un dossier de 10 000 fichiers bloquera l'event loop Tauri.
- **Pas de virtualisation** dans `TabBar` ni `FileTreePane` : tous les éléments sont rendus dans le DOM. Pas un problème pour des usages courants, mais pourrait gratter sur de gros workspaces.

---

## 4. Données / Persistance (8 / 10)

### Forces
- **XDG-compliant** : `~/.config/miramd/preferences.json` via `dirs::config_dir()`.
- **Rétrocompatibilité serde** : `#[serde(default)]` sur chaque champ + `#[serde(rename_all = "camelCase")]`.
- **Forward-compatible** : test `serde_unknown_fields_ignored` qui vérifie que les champs inconnus n'explosent pas.
- **Backup automatique** : `.json.bak` avant chaque écriture.
- **Fallback gracieux en cascade** : `dirs::config_dir()` → `home_dir/.config` → `/tmp`.
- **JSON corrompu → defaults** : pas de crash, log warning et recréation.
- **`prefsVersion: u32`** déclaré (default = 1), prêt pour de futures migrations.

### Friction
- **Pas de migration de schéma implémentée** : `prefs_version` existe mais n'est jamais vérifié. Un changement breaking utiliserait silencieusement les defaults.
- **Backup silencieux** : si l'écriture du `.bak` échoue (disque plein, permissions), erreur loggée WARN et ignored.
- **Fallback `/tmp`** : si la config dir n'est pas accessible, les prefs partent dans `/tmp` — perdues au prochain boot.
- **`preferences.patch()` est fire-and-forget** : `catch()` ajouté côté frontend, mais l'utilisateur n'est pas averti d'une erreur de sauvegarde.

---

## 5. Gestion d'erreurs / Fiabilité (6.5 / 10)

### Forces
- **Type d'erreur custom Rust** : `AppError` enum (6 variantes), `thiserror` pour la dérivation, `?` pour la propagation.
- **Sérialisation explicite** vers le frontend (string).
- **Logging structuré** côté Rust : `log::info!`, `log::warn`, `log::debug` (env_logger en dev, no-op en release).
- **Toast store côté frontend** : `showToast(text, kind, duration)` pour notifier l'utilisateur (kind: error / warning / info / success).
- **Try-catch systématiques** dans `MuyaService` autour de chaque appel Muya.

### Friction (importante)
- **`autoSave` fire-and-forget** : le callback de sauvegarde est invoqué sans attendre de confirmation backend. Pas de retry, pas de notification explicite. Si l'écriture échoue, l'utilisateur croit que c'est sauvegardé.
- **`preferences.patch()` silencieux** : `.catch()` log seulement, l'utilisateur ne voit rien.
- **Pas de timeout** sur les commandes IPC : une commande qui se fige fige l'UI sans feedback.
- **Stack traces non exposées** : c'est correct pour la prod, mais en dev il manque un mode verbose.

C'est probablement la source de **« je ne détecte pas mes propres bugs »** mentionné par l'utilisateur : les chemins d'erreur sont silencieux par défaut. Voir `problemes-connus.md` pour les pistes.

---

## 6. Maintenabilité (7 / 10)

### Forces
- **TypeScript strict** côté frontend (sauf `src/lib/muya/**` exclu, c'est du legacy vendored).
- **Biome 2** : format + lint en un seul outil, configuration courte (biome.json).
- **Husky + lint-staged** : pre-commit hooks (`biome check --write` sur TS/JS, `cargo fmt --check` sur Rust).
- **Tests unitaires backend** : 28 tests Rust intégrés dans les modules.
- **Tests frontend** : 13 fichiers de test (services, stores, intégration full-app).
- **Code Rust idiomatique** : pas de `unsafe`, gestion d'erreur consistante.

### Friction
- **Muya vendored sans synchronisation upstream** : `src/lib/muya/` est figé. Si MarkText sort un fix Muya, il faut le rapatrier manuellement.
- **Code dupliqué** : `is_markdown_file()` (lib.rs:40, lib.rs:64), pattern `setAttribute('data-theme')` + `setProperty('--font-size')` dupliqué entre `+page.svelte` et `SettingsModal.svelte`.
- **TOC extraction naïve** : regex `^(#{1,6})\s+(.+)` (editor.ts) — ne tient pas compte des blocs de code, des fenced regions, des frontmatters.
- **Stats côté frontend** : `stats.ts` calcule en local. Cohérent en single-source-of-truth, mais pose la question si on voulait des stats plus complexes.
- **Pas de TypeScript** sur le code Muya (vendored JS), donc pas de garantie d'API stable côté wrapper `MuyaService`.

---

## 7. Frontend / Tauri (8.5 / 10)

| Composant | Version | Statut |
|---|---|---|
| Tauri | 2.x | ✅ Stable, support actif |
| Svelte | 5.x | ✅ Récent, runes API moderne |
| SvelteKit | 2.9 | ✅ |
| Vite | 6.0 | ✅ |
| Biome | 2.0 | ✅ |
| comrak (Rust) | 0.36 | ✅ |
| Muya (vendored) | 0.1.2 (origine MarkText) | ⚠️ Pas de mise à jour automatique |
| Snabbdom (dans Muya) | héritage | ✅ Stable |
| DOMPurify | 3.3.3 | ✅ |
| Mermaid, KaTeX, Prism | dernières | ✅ |

### Notes
- **Pas de virtual DOM côté Svelte** : Svelte compile vers du DOM natif. Le seul VDOM dans le projet est Snabbdom à l'intérieur de Muya.
- **WebKitGTK sur Linux** : utilisé par Tauri pour le rendu. Il **ne supporte pas certains contenteditable behaviors natifs** (Ctrl+Z notamment) — d'où l'intercept capture phase dans `MuyaPane.svelte`. C'est une source potentielle de bugs subtils.

---

## 8. Tests / Observabilité (7 / 10)

### Tests
| Type | Framework | Nombre | Couverture |
|---|---|---|---|
| Unit Rust | `#[cfg(test)]` | 28 | markdown.rs, preferences.rs, filesystem.rs |
| Unit/Integration JS | Vitest + jsdom | 13 fichiers (~1842 lignes) | services (6), stores (3), intégration (4) |
| Coverage | V8 (frontend), tarpaulin (Rust) | text + lcov + cobertura | Reportée en CI |

**13 fichiers de test frontend** :
- Services : editorModes, fileOperations, lineNumbers, stats, typewriterScroller, zoom
- Stores : editor, preferences, toast
- Intégration : full-app, features, regression, keyboard

### Observabilité en runtime
- **`debug_log` IPC command** : conditionnée à `#[cfg(debug_assertions)]` — no-op en release.
- **`electron-log` équivalent** non utilisé : `log` + `env_logger` côté Rust seulement.
- **Pas de telemetry**, pas de crash reporter (correct pour un éditeur de texte local-first).

### Manques
- **Pas de tests E2E** réels (Playwright/WebDriver) — l'app n'est pas lancée pour vérifier les flux complets.
- **Pas de tests pour MuyaPane.svelte** : c'est le composant le plus complexe, pas de test direct.
- **Pas d'instrumentation centralisée** : pour comprendre un bug en prod (Ctrl+Z, sauvegarde), il faut reproduire localement avec des `console.log`. Voir `problemes-connus.md` pour la suggestion d'un mode debug global.

---

## 9. Deployment / Ops (9 / 10)

### CI/CD (`.github/workflows/`)
- **`ci.yml`** — 7 jobs en parallèle :
  1. `check` (TypeScript + svelte-check + Biome)
  2. `test-frontend` (Vitest + coverage)
  3. `rust-lint` (`cargo fmt --check` + `cargo clippy -D warnings`)
  4. `test-rust` (`cargo test` + tarpaulin)
  5. `security-audit` (`npm audit --audit-level=moderate` + `cargo audit`) — **bloquant**
  6. `build` (matrice 3 OS, attend les 5 précédents)
- **`release.yml`** — déclenché par tag `v*`, build identique sans audit, draft GitHub release avec notes auto-générées.

### Packaging (`tauri.conf.json`)
- **Multi-format** : `.deb`, `.AppImage`, `.dmg`, `.msi`, `.nsis (.exe)`
- **Bundle target `"all"`** : tous les formats sont produits.
- **Icônes multi-résolution** : 32×32, 128×128, `.icns`, `.ico`.
- **CSP restrictive** déjà en place, SPA mode avec fallback `index.html`.
- **Single-instance plugin** activé : un second lancement avec un fichier en argument ouvre dans la fenêtre existante.

### À noter
- Pas de signing automatisé documenté (à faire manuellement à chaque release ?).
- Pas d'auto-update Tauri activé.

---

## 10. DX (Developer Experience) (8 / 10)

### Forces
- **Scripts npm clairs** : `dev`, `build`, `tauri dev`, `test`, `check`, `lint`, `format`.
- **Hot reload** Vite + Tauri.
- **Pre-commit hooks** : Biome check + `cargo fmt --check`.
- **Type checking** intégré (`svelte-check` + `tsc`).
- **CONTRIBUTING.md** existant.
- **CLAUDE.md** présent (référence pour Claude Code).
- **Logique de tests** : services + stores testables individuellement.

### Friction
- **Pas de TypeScript sur Muya** : l'API est typée à la main dans `src/lib/types/muya-instance.ts`. Si Muya change, le typage diverge silencieusement.
- **Pas de mode "debug global"** : impossible d'activer un toggle qui ferait pleuvoir les logs de tous les services. Pour débugger un bug de Ctrl+Z, il faut sprinkler des `console.log` dans plusieurs fichiers.
- **Pas de Storybook ou playground** pour les composants Svelte isolés.

---

## Synthèse finale

### Score global : **8.0 / 10**

| Dimension | Score | Niveau |
|---|---|---|
| Architecture | 8.5 | ✅ |
| Sécurité | 9.0 | ✅ |
| Performance | 8.0 | ✅ |
| Données / Persistance | 8.0 | ✅ |
| Gestion d'erreurs | 6.5 | ⚠️ |
| Maintenabilité | 7.0 | ⚠️ |
| Frontend / Tauri | 8.5 | ✅ |
| Tests / Observabilité | 7.0 | ⚠️ |
| Deployment / CI | 9.0 | ✅ |
| DX | 8.0 | ✅ |

### Top 5 chantiers prioritaires

| # | Action | Priorité | Effort |
|---|---|---|---|
| 1 | **Instrumenter la gestion d'erreurs** : remplacer les `.catch(...)` silencieux d'`autoSave` et `preferences.patch()` par des notifications utilisateur via `toast`. Mode debug global (logger toutes les transitions de Muya, autoSave, preferences). | 🚨 P0 | Faible |
| 2 | **Stabiliser undo/redo** : auditer l'interaction `historyCache` ↔ Muya internal history ↔ intercept Ctrl+Z capture phase. Ajouter des tests d'intégration sur le scénario "tab switch + undo". | 🚨 P0 | Moyen |
| 3 | **Stabiliser la TOC** : remplacer la regex naïve par un parsing AST (réutiliser comrak côté frontend ou créer une commande IPC `extract_headings`). | ⚠️ P1 | Moyen |
| 4 | **Améliorer la fiabilité de `autoSave`** : retry exponentiel, notification utilisateur en cas d'échec, idempotence (pas d'écriture si contenu inchangé). | ⚠️ P1 | Faible |
| 5 | **Migration de schéma `preferences`** : implémenter le mécanisme `prefs_version` (déjà déclaré) avant de pousser un nouveau champ breaking. | ⚠️ P2 | Faible |

### Verdict

MiraMD est une **réécriture techniquement saine et bien sécurisée** de MarkText, avec un footprint exceptionnel et une architecture lisible. Le projet n'est pas en danger sur ses fondations : Tauri/Svelte/Rust sont tous des choix solides et récents.

La **dette principale est dans la couche d'intégration custom** (services qui orchestrent Muya, gestion d'erreurs silencieuse, debouncings empilés) — c'est elle qui produit les bugs visibles par l'utilisateur (Ctrl+Z, sauvegarde, TOC). Le moteur Muya en lui-même reste celui de MarkText, donc bon, mais le wrapper a tendance à laisser passer les erreurs sans les remonter.

**La voie de progression la plus efficace n'est pas une refonte mais un travail d'instrumentation et de fiabilisation** : rendre les erreurs visibles, ajouter des tests d'intégration sur les scénarios fragiles (tab switching, undo, autoSave), durcir les chemins critiques. Avec 2 à 4 semaines de ce type de travail, MiraMD passerait probablement de "alpha avec des bugs subtils" à "beta exploitable au quotidien".
