# Build et packaging

Cette page décrit le **trajet du code source jusqu'au binaire installable** (`.deb`, `.dmg`, `.exe`...). Deux pipelines indépendants se rejoignent au moment du packaging : un pipeline frontend ([Vite](../01-decouverte/glossaire.md#vite) + [SvelteKit](#)) et un pipeline backend ([Cargo](../01-decouverte/glossaire.md#cargo) + `tauri-build`). [Tauri](../01-decouverte/glossaire.md#tauri) CLI orchestre les deux.

## Pipeline frontend

**Outils** : [Vite](../01-decouverte/glossaire.md#vite) 6 + [SvelteKit](#) 2.9 + adapter-static + Svelte 5 + TypeScript 5.6.

Configuration :

- [`vite.config.js`](../../vite.config.js) — port fixe `1420` (Tauri l'attend), exclusion de `src-tauri/**` du watcher, support optionnel d'un host externe via `TAURI_DEV_HOST`.
- [`svelte.config.js`](../../svelte.config.js) — `adapter-static({ fallback: "index.html" })`. Mode **SPA** : SvelteKit produit un site statique, fallback `index.html` pour toutes les routes côté client (Tauri n'a pas de serveur Node pour faire du SSR).

Les scripts npm pertinents (`package.json:6-19`) :

| Script | Commande | Rôle |
|---|---|---|
| `dev` | `vite dev` | Sert le frontend en hot-reload sur `localhost:1420`. Démarré automatiquement par `tauri dev`. |
| `build` | `vite build` | Compile le frontend statique dans `build/`. Démarré automatiquement par `tauri build`. |
| `check` | `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json` | Vérifications TypeScript + Svelte. |
| `lint` / `lint:fix` | `biome check src/` / `biome check --write src/` | Lint via [Biome](../01-decouverte/glossaire.md#biome). |
| `format` | `biome format --write src/` | Formatage. |
| `test` | `vitest run` | Tests unitaires + intégration frontend (jsdom). |
| `test:coverage` | `vitest run --coverage` | Tests + couverture V8 (rapports `lcov.info`). |
| `tauri` | `tauri` | Forward toutes les sous-commandes Tauri CLI (`tauri dev`, `tauri build`, etc.). |

À la sortie de `vite build`, le dossier `build/` contient `index.html` + le bundle JS/CSS Svelte. **Note importante** : `static/muya/index.min.js` (~2.5 MB) et les feuilles CSS Muya sont **copiées** depuis `static/` vers `build/` par SvelteKit, mais **pas** rebundlées (cf. [`integration-muya.md`](integration-muya.md)). Muya est livré tel quel, en `<script>` global.

## Pipeline backend

**Outils** : [Cargo](../01-decouverte/glossaire.md#cargo) (Rust stable) + `tauri-build` 2.

Configuration :

- [`src-tauri/Cargo.toml`](../../src-tauri/Cargo.toml) — déclare le package `miramd` (lib `miramd_lib`), 12 dépendances : `tauri 2` (avec `tray-icon`), 4 plugins Tauri (`single-instance`, `opener`, `dialog`, `fs`), `serde`, `serde_json`, `comrak 0.36` (avec `syntect`), `dirs 6`, `thiserror 2`, `log`, `env_logger`. La build-dependency `tauri-build 2` génère le contexte applicatif au compile time.
- [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json) — `beforeDevCommand: "npm run dev"`, `beforeBuildCommand: "npm run build"`, `frontendDist: "../build"`. Autrement dit : Tauri lance lui-même les scripts npm avant le build Rust, puis cherche le frontend dans `build/`.

`cargo build --release --manifest-path src-tauri/Cargo.toml` compile le binaire ; en pratique on appelle plutôt `npm run tauri build` qui orchestre tout.

## Commande `npm run tauri build` — ce qui se passe

```
npm run tauri build
   │
   ├── 1. tauri.conf.json:beforeBuildCommand → npm run build
   │      └── vite build → build/ (frontend statique)
   │
   ├── 2. cargo build --release (src-tauri/)
   │      └── tauri-build inclut build/ comme ressource embarquée
   │      └── binaire produit : src-tauri/target/release/miramd
   │
   └── 3. tauri-bundler (avec bundle.targets = "all")
          ├── Linux  → .deb, .rpm, .AppImage
          ├── macOS  → .dmg
          └── Windows → .msi (WiX) + .exe (NSIS)
          → src-tauri/target/release/bundle/<format>/
```

## Bundle targets — `"all"`

Dans `tauri.conf.json:31` : `"targets": "all"`. À l'inverse d'une sélection (`["deb", "appimage"]`), `"all"` produit **tous les formats supportés par la plate-forme courante**. Ce qui signifie sur chaque OS :

| OS du runner | Formats produits | Dossier de sortie |
|---|---|---|
| Linux | `.deb`, `.rpm`, `.AppImage` | `src-tauri/target/release/bundle/{deb,rpm,appimage}/` |
| macOS | `.dmg`, `.app` | `src-tauri/target/release/bundle/{dmg,macos}/` |
| Windows | `.msi` (Wix), `.exe` (NSIS) | `src-tauri/target/release/bundle/{msi,nsis}/` |

Le binaire pèse ~5 MB, le bundle final dépend du format (l'`.AppImage` Linux est le plus gros parce qu'il embarque ses libs). Pas d'auto-update Tauri activé pour le moment, pas de signing automatisé documenté (cf. [audit](../06-references/audit.md), section 9).

## Tests

### Frontend — Vitest

13 fichiers de test (~1842 lignes) sous [`tests/`](../../tests/), répartis en :

- **Services** (6) : `tests/services/editorModes.test.ts`, `fileOperations.test.ts`, `lineNumbers.test.ts`, `stats.test.ts`, `typewriterScroller.test.ts`, `zoom.test.ts`.
- **Stores** (3) : `tests/stores/editor.test.ts`, `preferences.test.ts`, `toast.test.ts`.
- **Intégration** (4) : `tests/integration/full-app.test.ts`, `features.test.ts`, `regression.test.ts`, `keyboard.test.ts`.

Environnement : `jsdom` (DOM simulé en Node). Lancement :

```bash
npm run test          # ponctuel
npm run test:watch    # mode watch
npm run test:coverage # avec couverture V8 (lcov + cobertura)
```

**Pas de tests E2E** réels (Playwright/WebDriver) — l'app n'est pas réellement lancée pour vérifier les flux complets. Le composant `MuyaPane.svelte` n'a pas de test direct (Muya nécessite un DOM complet, jsdom est insuffisant). Voir [audit](../06-references/audit.md), section 8.

### Backend — `cargo test`

28 tests Rust intégrés dans les modules (`#[cfg(test)] mod tests`) :

- `markdown.rs` : 6 tests (basique, table GFM, strikethrough, tasklist, HTML strippé, taille max).
- `preferences.rs` : 6 tests (defaults valides, validation des bornes, roundtrip, fields manquants/inconnus).
- `filesystem.rs` : 16 tests (path traversal, write path, filename validation, atomicité, pagination, fichiers cachés, etc.).

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Couverture mesurée par `cargo-tarpaulin` en CI (rapport Cobertura).

## CI — `.github/workflows/ci.yml`

7 jobs déclarés, 5 en parallèle puis le `build` qui dépend des autres et lui-même en matrice 3 OS.

| Job | Runner | Étapes principales | Bloquant pour `build` ? |
|---|---|---|---|
| `check` | ubuntu-latest | `npm ci`, `npx svelte-kit sync`, `npm run check`, `npm run lint` | Oui |
| `test-frontend` | ubuntu-latest | `npm ci`, `npm run test:coverage`, upload `lcov.info` | Oui |
| `rust-lint` | ubuntu-latest | `cargo fmt --check`, `cargo clippy -- -D warnings` | Oui |
| `test-rust` | ubuntu-latest | `cargo test`, `cargo tarpaulin --out Xml`, upload coverage | Oui |
| `security-audit` | ubuntu-latest | `npm audit --audit-level=moderate`, `cargo audit --file src-tauri/Cargo.lock` | **Oui (bloquant)** |
| `build` (linux) | ubuntu-latest | `npm ci`, `npm run tauri build`, upload `.deb` + `.AppImage` | — |
| `build` (macos) | macos-latest | `npm ci`, `npm run tauri build`, upload `.dmg` | — |
| `build` (windows) | windows-latest | `npm ci`, `npm run tauri build`, upload `.msi` + `.exe` | — |

Détails à noter :

- Sur Linux, le job installe les dépendances système nécessaires : `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, `libgtk-3-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev` (`ci.yml:55, 70-71, 124-126`). Sur macOS et Windows, le runner contient déjà ce qu'il faut.
- `Swatinem/rust-cache@v2` est utilisé pour les jobs Rust avec `workspaces: 'src-tauri -> target'` — accélère sensiblement les builds répétés.
- Les artefacts sont nommés par OS : `miramd-linux`, `miramd-macos`, `miramd-windows`.

## Release — `.github/workflows/release.yml`

Déclenché par push d'un tag `v*` (par exemple `v0.1.0`). Comportement :

1. Build matrice 3 OS (linux/macos/windows) — **identique** au job `build` du CI **mais sans audit**.
2. Job `release` : télécharge tous les artefacts, crée une **release GitHub en draft** avec notes auto-générées (`gh release create --draft --generate-notes`), uploade tous les bundles.

Le mainteneur passe ensuite la release de "draft" à "publié" manuellement après vérification.

## Audit sécurité dans CI

Détail dans [`securite.md`](securite.md), section "Audit CI". Les deux commandes sont :

```yaml
- run: npm audit --audit-level=moderate
- run: cargo install cargo-audit
- run: cargo audit --file src-tauri/Cargo.lock
```

Le job `security-audit` est listé dans `needs:` du job `build` (`ci.yml:100`). Une CVE détectée échoue la PR.

## Pre-commit hooks — Husky + lint-staged

Configuration dans `package.json:21-28` :

```json
"lint-staged": {
  "*.{ts,js}": ["biome check --write --no-errors-on-unmatched"],
  "*.rs": ["cargo fmt --check"]
}
```

Le script `prepare: husky` (`package.json:19`) est exécuté à chaque `npm install` pour activer les hooks.

À chaque `git commit`, lint-staged :

1. Sur les fichiers `.ts` / `.js` modifiés : lance `biome check --write` ([Biome](../01-decouverte/glossaire.md#biome) corrige automatiquement format + lint, et stagne les corrections).
2. Sur les fichiers `.rs` modifiés : lance `cargo fmt --check` (échec si pas formaté). Note : c'est `--check`, donc le commit échoue plutôt que de corriger. Le développeur doit lancer `cargo fmt` manuellement et re-stager.

Ces hooks **n'exécutent pas les tests** ni `cargo clippy` — c'est intentionnel (rapidité du commit). Le filet de sécurité reste la CI.

## Synthèse

```
[git commit] ──Husky──▶ biome check --write (TS/JS)
                        cargo fmt --check (Rust)
       │
       ▼
[git push] ──CI ci.yml──▶ check + lint + test-frontend + rust-lint
                          + test-rust + security-audit
                          ↓ (tous verts)
                          build matrix (linux/macos/windows)
                          ↓
                          .deb / .AppImage / .dmg / .msi / .exe (artefacts)

[git tag v*] + push ──release.yml──▶ build matrix
                                     ↓
                                     gh release create --draft --generate-notes
```

Pour le détail des validations Rust et des limites de sécurité : [`securite.md`](securite.md). Pour les commandes IPC : [`backend-rust.md`](backend-rust.md). Pour le rôle du dossier `static/muya/` dans le bundle : [`integration-muya.md`](integration-muya.md).
