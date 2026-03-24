# Audit complet — MiraMD

**Date** : 2026-05-10 (refresh ; précédente version 2026-04-29)
**Version analysée** : 0.1.0
**Stack** : Tauri 2 (Rust) · Svelte 5 · Muya (vendored, chargé en `window.Muya`) · Vite 6 · Biome 2 · comrak 0.36

> Refresh déclenché par 10+ entrées de `problemes-connus.md` résolues entre le 2026-04-29 et le 2026-05-10. Sont mises à jour : le résumé, les listes de friction de chaque section, les compteurs de tests, et le top-5 des chantiers (les 5 originaux sont tous terminés).

---

## Résumé exécutif

MiraMD est une réécriture moderne et bien architecturée de MarkText. Le backend Rust est minimaliste, sûr (path traversal protégé, limites de taille, comrak avec `unsafe_=false`), et bien testé (32 tests Rust + 436 tests frontend, soit 468 au total). Le frontend Svelte 5 est découpé proprement en services singletons et stores, avec un seul point d'accès à Muya (`MuyaService`). Le pipeline CI/CD est complet : 7 jobs en parallèle, audit sécurité bloquant, builds multi-OS.

Depuis l'audit du 2026-04-29, le projet a fait un **bond significatif vers la stabilité** : refonte du zoom (vrai zoom WebKit natif), refonte du mode lecture (classe CSS `.muya-readonly`), refonte du mode typewriter (fallback parent rect), refonte complète du mode split (sous-mode du source, sync ancrée sur les headings, double-clic word highlight, mode delta scroll), drag fenêtre global Linux/WebKitGTK, mode debug global (`dlog(subject, ...)` + panneau Ctrl+Shift+D), et liquidation complète de la dette structurelle persistante (toasts UX sur erreurs prefs, migration schéma câblée, timeout IPC, factorisation CLI).

Il reste deux bugs cosmétiques mineurs (police bash neutralisée le 2026-05-10 mais à vérifier visuellement, bugs tableaux Muya vendored hérités) et le moteur Muya lui-même reste celui de MarkText (vendored), donc les fonctionnalités d'édition continuent d'hériter de sa maturité comme de ses limites. Hors Muya, **MiraMD est désormais en état beta exploitable**.

---

## 1. Architecture (8.5 / 10)

### Forces
- **Trois couches nettement séparées** : UI Svelte (composants + stores), moteur Muya (vendored), backend Rust (Tauri).
- **MuyaService = passerelle unique** vers l'instance Muya (singleton, encapsule tous les appels). Aucun composant Svelte ne touche Muya directement.
- **Backend Rust à responsabilité claire** : 5 modules (`lib.rs`, `error.rs`, `filesystem.rs`, `markdown.rs`, `preferences.rs`), aucun module > 270 lignes.
- **9 commandes IPC** bien typées, retours `Result<T, AppError>` sérialisés en string ; `load_preferences` et `save_preferences` retournent désormais `LoadResult/SaveResult { warnings: Vec<String> }` pour bubble up des codes de warning non-fatals.
- **Pattern services singletons** côté frontend : ~17 services (muya, autoSave, fileOperations, shortcuts, editorModes, zoom, appZoomWheel, lineNumbers, typewriterScroller, typewriterPadding, typewriterSound, windowInit, windowDrag, stats, historyCache, toc, splitScrollSync, splitWordHighlight, ipc, debug). La règle "pure functions extraites en services pour testabilité" est désormais systématique.
- **Stores Svelte cohérents** : `editor` (tabs + activeTab + stats), `preferences`, `toast`, `muyaInstance`, `debug` (flags par sujet typé).

### Friction
- **Muya chargé en script global `window.Muya`** depuis `static/muya/index.min.js` (pas de bundle Vite). Choix justifié par la nature vendored, mais le couple `window.Muya` + intégration TypeScript via `(window as any).Muya` réduit la sûreté de typage.
- **Pas de bus d'événements** au niveau frontend : la coordination entre services passe par les stores. C'est correct mais peut devenir confus quand plusieurs services lisent/écrivent le même store.

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
- **Cancellation IPC absente** : `invokeWithTimeout` (commit `cde5017`) garantit que le frontend ne reste pas bloqué (rejet après 30 s pour les flows file I/O, 5 s pour les prefs) mais n'annule pas le travail Rust côté backend — il continue. À considérer si on voulait vraiment couper une opération longue.

---

## 3. Performance / Scalabilité (8 / 10)

### Forces
- **Footprint exceptionnel** : ~5 MB de binaire, ~30 MB de RAM (vs ~200 MB / 300 MB pour MarkText).
- **Debouncing systématique** : content update 100 ms, stats 300 ms, prefs save 200 ms, source→Muya sync 400 ms.
- **Throttle typewriter** : 50 ms via `requestAnimationFrame` — pas de layout thrashing.
- **Sync split scroll ancrée sur les headings** (`splitScrollSync.ts`) : interpolation entre headings, fallback proportionnel, mode delta après double-clic pour éviter le rollback. Évite le re-layout cascade.
- **Pagination backend** : `list_directory_entries(offset, limit)` supporte le découpage.
- **Lazy imports Tauri** : `await import('@tauri-apps/api/window')` dans `windowInit.ts`.
- **Cleanup des timers** : `contentTimer`, `statsTimer` annulés au changement d'onglet et au démontage.

### Friction
- **I/O Rust synchrone** : `read_file`, `write_file`, `create_file`, `list_directory_entries` sont tous synchrones. Acceptable pour un éditeur, mais un fichier de 50 MB ou un dossier de 10 000 fichiers bloquera l'event loop Tauri. Atténué par `invokeWithTimeout` côté frontend (UI ne gèle pas), pas par le runtime Rust.
- **Pas de virtualisation** dans `TabBar` ni `FileTreePane` : tous les éléments sont rendus dans le DOM. Pas un problème pour des usages courants, mais pourrait gratter sur de gros workspaces.

---

## 4. Données / Persistance (9 / 10)

### Forces
- **XDG-compliant** : `~/.config/miramd/preferences.json` via `dirs::config_dir()`.
- **Rétrocompatibilité serde** : `#[serde(default)]` sur chaque champ + `#[serde(rename_all = "camelCase")]`.
- **Forward-compatible** : test `serde_unknown_fields_ignored` qui vérifie que les champs inconnus n'explosent pas.
- **Backup automatique** : `.json.bak` avant chaque écriture, **avec feedback** si l'écriture du `.bak` échoue (toast warning frontend via warning code `prefs_backup_failed`, l'écriture principale n'est pas bloquée).
- **Fallback gracieux en cascade** : `dirs::config_dir()` → `home_dir/.config` → `/tmp`. **Avec feedback** : `prefs_path_with_warnings()` retourne `(PathBuf, Vec<String>)`, `load_preferences` propage le code `prefs_tmp_fallback` une fois au démarrage si tombé sur `/tmp`. `save_preferences` discard ce warning pour éviter le spam.
- **JSON corrompu → defaults** : pas de crash, log warning et recréation.
- **Migration de schéma câblée** : constante `CURRENT_PREFS_VERSION`, helper `migrate_preferences()` retourne `MigrationResult` (AlreadyCurrent / Migrated{from} / FutureVersion{actual}). `load_preferences` persiste après migration. Cas downgrade détecté (warning `prefs_future_version`). 4 tests + garde-fou contre la dérive `default_prefs_version` ↔ `CURRENT_PREFS_VERSION`.
- **Erreurs `save_preferences` toastées côté frontend** : `save()` enroule en try/catch + toast d'erreur explicite, `patch()` chaîne `.catch(reportSaveError)` au lieu du précédent `console.warn` silencieux.

### Friction
- (résiduel) — Les toasts spam si le disque est cassé : `patch()` est appelé sur chaque mode toggle / Ctrl+wheel zoom, donc un disque inopérant peut générer une avalanche. Acceptable car pathologique (l'app est globalement non-utilisable dans ce cas), mais une dédup côté frontend (un seul toast par session) serait propre.

---

## 5. Gestion d'erreurs / Fiabilité (8.5 / 10)

### Forces
- **Type d'erreur custom Rust** : `AppError` enum (6 variantes), `thiserror` pour la dérivation, `?` pour la propagation.
- **Sérialisation explicite** vers le frontend (string).
- **Logging structuré** côté Rust : `log::info!`, `log::warn`, `log::debug` (env_logger en dev, no-op en release).
- **Toast store côté frontend** : `showToast(text, kind, duration)` pour notifier l'utilisateur (kind: error / warning / info / success).
- **Try-catch systématiques** dans `MuyaService` autour de chaque appel Muya.
- **Mode debug global** (livré 2026-05-09) : helper `dlog(subject, ...args)` (`src/lib/services/debug.ts`) gate par sujet typé (9 sujets : `typewriter, ctrlz, save, muya, zoom, editorModes, prefs, sound, toc`). Activation via `localStorage.miramd_debug` ou panneau flottant `Ctrl+Shift+D`. Badge orange `DEBUG: ...` dans la status bar quand ≥1 sujet actif. Doc : `docs/05-fonctionnalites/mode-debug.md`. **C'était le plus gros manque de l'audit précédent.**
- **Erreurs `write_file` correctement propagées** : audit 2026-05-09 a vérifié que les 4 call sites de `write_file` côté frontend (`fileOperations.ts:51,64,93` + `TabBar.svelte:48`) ont try/catch + toast + skip `markSaved` — la doc précédente reflétait probablement un état antérieur déjà fixé.
- **Erreurs `save_preferences` toastées** (commit `242a453`) : remplace les `.catch(console.warn)` silencieux. Plus de Promise rejections unhandled sur les flows `setTimeout`.
- **Timeout IPC sur les flows user-initiated** (commit `cde5017`) : `invokeWithTimeout` race contre `setTimeout`, rejette `IpcTimeoutError` avec `command` et `timeoutMs` portés sur l'erreur. 30 s pour file I/O, 5 s pour les prefs.

### Friction résiduelle
- **`autoSave` fire-and-forget** : le callback de sauvegarde est invoqué sans attendre de confirmation backend. Au moins maintenant les erreurs `write_file` sous-jacentes toastent (vu que `saveCurrentFile` les capture), mais autoSave en lui-même ne traite pas l'absence de path ou les erreurs réseau d'une manière différente d'un save manuel. **Plus prioritaire** : ajouter un retry exponentiel et une déduplication idempotente (skip si contenu inchangé).
- **Pas de cancellation IPC** : `invokeWithTimeout` abandonne la promesse JS mais le Rust continue. Pour vraiment couper, il faudrait un mécanisme de cancellation token côté Rust.
- **Stack traces non exposées** : c'est correct pour la prod, mais en dev les erreurs frontend pourraient utiliser le sujet `prefs`/`save` du mode debug pour tracer.

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
- **Code dupliqué résiduel** : pattern `setAttribute('data-theme')` + `setProperty('--font-size')` dupliqué entre `+page.svelte` et `SettingsModal.svelte` (la duplication CLI `is_markdown_file` a été factorisée dans `validated_cli_file()` le 2026-05-10).
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
- **WebKitGTK sur Linux** : utilisé par Tauri pour le rendu. Plusieurs comportements divergent de Chromium et ont demandé du contournement : (1) **contenteditable Ctrl+Z** non natif → intercept capture phase dans `MuyaPane.svelte` ; (2) **`-webkit-app-region: drag` inopérant** → drag fenêtre programmatique via `appWindow.startDragging()` (`src/lib/services/windowDrag.ts`, listener mousedown global avec sélecteur d'exclusion exhaustif) ; (3) **Web Audio `AudioDestinationGStreamer.maxChannelCount = 0`** → pivot HTML5 `<audio>` + base64 WAV pour les typewriter sounds ; (4) **CSS Highlight API et Selection API instables cross-éléments** → span-wrapping pur pour le word highlight du mode split ; (5) **`muya.setMarkdown()` qui vole le focus** → focusin guardian sur document + multi-passe refocus en `applySetMarkdownPreservingFocus()`. Toutes ces solutions sont stables aujourd'hui mais à connaître pour ne pas réintroduire le bug naïvement.

---

## 8. Tests / Observabilité (7 / 10)

### Tests
| Type | Framework | Nombre | Couverture |
|---|---|---|---|
| Unit Rust | `#[cfg(test)]` | 32 | markdown.rs, preferences.rs (incl. 4 tests migration), filesystem.rs |
| Unit/Integration JS | Vitest + jsdom | 26 fichiers, **436 tests** | services, stores, intégration |
| Coverage | V8 (frontend), tarpaulin (Rust) | text + lcov + cobertura | Reportée en CI |

**26 fichiers de test frontend** couvrent désormais : appZoomWheel, debug, editorModes, fileOperations, fontSize, ipc, lineNumbers, muyaHeading, splitScrollSync, splitWordHighlight, stats, toc, typewriterPadding, typewriterScroller, typewriterSound, windowDrag, zoom (côté services) ; editor, preferences, toast (stores) ; full-app, features, regression, keyboard (intégration). La discipline "extraire la logique non-triviale d'un `.svelte` vers un service pour testabilité vitest" est maintenant systématique.

### Observabilité en runtime
- **Mode debug global `dlog(subject, ...args)`** (livré 2026-05-09) : 9 sujets typés (`typewriter, ctrlz, save, muya, zoom, editorModes, prefs, sound, toc`), gating zéro-coût quand off, panneau flottant Ctrl+Shift+D, badge status bar quand actif. Persistance localStorage. Documenté dans `docs/05-fonctionnalites/mode-debug.md`. **A remplacé le manque "Pas d'instrumentation centralisée" de l'audit précédent.**
- **`debug_log` IPC command** : conditionnée à `#[cfg(debug_assertions)]` — no-op en release. Permet au frontend de loguer dans la console Rust en dev.
- **`electron-log` équivalent** non utilisé : `log` + `env_logger` côté Rust seulement.
- **Pas de telemetry**, pas de crash reporter (correct pour un éditeur de texte local-first).

### Manques
- **Pas de tests E2E** réels (Playwright/WebDriver) — l'app n'est pas lancée pour vérifier les flux complets bout-en-bout (le tunnel `npm run tauri dev` + clic-and-vérif reste manuel).
- **Pas de tests pour MuyaPane.svelte** : c'est le composant le plus complexe, pas de test direct (les helpers extraits sont testés, mais l'orchestration ne l'est pas).
- **Pas de test du SourcePane non plus** (split mode preview) — la logique pure est extraite et testée (`splitScrollSync`, `splitWordHighlight`, `editorModes`) mais le binding Svelte ne l'est pas.

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
- **Pas de Storybook ou playground** pour les composants Svelte isolés.
- ~~**Pas de mode "debug global"**~~ — résolu 2026-05-09 par `dlog()` + panneau Ctrl+Shift+D.

---

## Synthèse finale

### Score global : **8.6 / 10** (était 8.0)

| Dimension | Score | Δ | Niveau |
|---|---|---|---|
| Architecture | 8.5 | = | ✅ |
| Sécurité | 9.0 | = | ✅ |
| Performance | 8.0 | = | ✅ |
| Données / Persistance | 9.0 | +1.0 | ✅ |
| Gestion d'erreurs | 8.5 | +2.0 | ✅ |
| Maintenabilité | 7.5 | +0.5 | ⚠️ |
| Frontend / Tauri | 8.5 | = | ✅ |
| Tests / Observabilité | 8.5 | +1.5 | ✅ |
| Deployment / CI | 9.0 | = | ✅ |
| DX | 9.0 | +1.0 | ✅ |

Les progrès viennent essentiellement de la résolution de la dette d'observabilité (mode debug global), de la fiabilisation de la persistance (toasts UX, migration schéma) et de l'expansion massive des tests (28→32 Rust, ~13 fichiers→26 fichiers / 436 tests vitest).

### Top 5 chantiers prioritaires (refresh)

Les 5 originaux du 2026-04-29 sont **tous terminés** (instrumentation gestion d'erreurs, stabilisation undo/redo, refonte TOC, fiabilisation persistance, migration schéma). Voici les nouveaux prioritaires :

| # | Action | Priorité | Effort |
|---|---|---|---|
| 1 | **Améliorer la fiabilité de `autoSave`** : retry exponentiel, idempotence (skip si contenu inchangé), traçage via `dlog('save', ...)` (déjà déclaré). C'est le seul flow user-critical encore "fire-and-forget par design". | ⚠️ P1 | Faible |
| 2 | **Tests E2E réels** (Playwright/WebDriver) sur les flows critiques : ouvrir/éditer/sauvegarder, split mode round-trip, multi-tabs avec undo. Aujourd'hui seul le `npm run tauri dev` + clic manuel valide les composants Svelte non-extraits (MuyaPane, SourcePane). | ⚠️ P1 | Moyen |
| 3 | **Tester l'audit `audit_with_warnings`** sur des cas extrêmes côté disque : disque plein, permission read-only sur `~/.config`, fichiers prefs avec `prefsVersion: 99` (futur), `prefsVersion: 0` (legacy). Les tests unitaires couvrent `migrate_preferences` mais pas les chemins I/O complets. | ⚠️ P2 | Faible |
| 4 | **Bugs Muya tableaux** (vendored) — soit rapatrier des fixes upstream depuis le repo MarkText, soit anticiper le remplacement de Muya (cf. ADR `04-muya-conserve.md`). C'est devenu le bug visible le plus impactant. | 🟦 P2 | Grand |
| 5 | **Cancellation IPC côté Rust** : `invokeWithTimeout` abandonne la promesse JS mais le Rust continue tourner. Pour des opérations vraiment lourdes (read d'un fichier 50 MB sur disque réseau), un `CancellationToken` côté Rust permettrait de couper proprement. | 🟦 P3 | Moyen |

### Verdict

MiraMD est passée d'**alpha avec bugs subtils** (audit du 2026-04-29) à **beta exploitable au quotidien** (état 2026-05-10). La voie de progression suggérée par l'audit précédent — "instrumentation et fiabilisation, pas refonte" — a été suivie quasi à la lettre : 17 nouveaux services, 9 sujets de debug instrumentés, +6 entrées résolues dans `problemes-connus.md`, +138 tests vitest, refonte du split mode comme cas d'application de la doctrine "logique non-triviale → service pur testable".

Il reste de la dette résiduelle (autoSave robust, E2E tests, Muya tableaux) mais elle est **bien identifiée et localisée** — plus de zones grises où les bugs disparaissent dans le silence. Le projet est prêt à accumuler des features sans s'effondrer sous son propre poids ; le moteur Muya vendored reste le principal facteur limitant pour la maturité de l'édition elle-même.

**Prochain palier** : sortir Muya (remplacement progressif ou full rewrite) pour adresser à la fois `unsafe-eval` dans la CSP, les bugs de tableaux, et le couplage `window.Muya` non-typé. Hors ça, c'est de la consolidation incrémentale.
