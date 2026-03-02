# Backend Rust

Le backend de MiraMD est un **binaire [Rust](../01-decouverte/glossaire.md#rust) compilé** qui orchestre l'application native (fenêtre, tray, [IPC](../01-decouverte/glossaire.md#ipc)) et porte toutes les opérations sensibles : lecture/écriture de fichiers, parsing [Markdown](../01-decouverte/glossaire.md#markdown), persistance des préférences. Il est minimaliste : 5 modules, ~1000 lignes de code (tests inclus), aucun module au-dessus de 400 lignes.

Le code source vit dans [`src-tauri/src/`](../../src-tauri/src/). L'entrée standard du binaire est `main.rs` (6 lignes), qui appelle simplement `miramd_lib::run()` défini dans `lib.rs`.

## Vue d'ensemble du dossier `src-tauri/src/`

| Fichier | Lignes | Rôle |
|---|---|---|
| `lib.rs` | 166 | Point d'entrée, configuration de [Tauri](../01-decouverte/glossaire.md#tauri), tray icon, single-instance, `invoke_handler`. |
| `error.rs` | 35 | Type d'erreur custom `AppError`, sérialisation vers le frontend. |
| `filesystem.rs` | 389 | I/O fichiers : lecture, écriture, création, listing. Validations de chemin. |
| `markdown.rs` | 76 | Parsing Markdown via [comrak](../01-decouverte/glossaire.md#comrak). |
| `preferences.rs` | 322 | Schéma `Preferences`, load/save JSON, validation des bornes. |
| `main.rs` | 6 | Wrapper minimal qui appelle `miramd_lib::run()`. |

Trois plugins [Tauri](../01-decouverte/glossaire.md#tauri) sont activés (voir `lib.rs:22-26`) : `tauri-plugin-opener` (ouvrir un lien externe), `tauri-plugin-dialog` (dialogs natifs), `tauri-plugin-fs`, plus `tauri-plugin-single-instance` pour rediriger un second lancement vers la fenêtre existante.

## Module `lib.rs`

**Responsabilité** : orchestration générale. Construit l'application, déclare les commandes [IPC](../01-decouverte/glossaire.md#ipc), installe le tray icon, gère le mode "résident" (la fenêtre se cache au lieu de quitter).

**Dépendances principales** : `tauri` (avec la feature `tray-icon`), `tauri-plugin-single-instance`, `env_logger`, `log`.

**Fonctions publiques** :

- `pub fn run()` — `lib.rs:14-142`. Initialise `env_logger`, construit `tauri::Builder`, enregistre les plugins et les 9 commandes [IPC](../01-decouverte/glossaire.md#ipc), configure le tray icon avec un menu (`Ouvrir MiraMD`, `Quitter MiraMD`), et installe un handler `on_window_event` qui transforme la fermeture de fenêtre en simple `hide()`.
- `fn is_markdown_file(path: &Path) -> bool` — `lib.rs:145-150`. Renvoie `true` si l'extension du fichier est `md`, `markdown`, `mmd`, `mdx` ou `mkd` (insensible à la casse). Utilisée à la fois par le setup CLI (`lib.rs:64`) et par le handler du plugin single-instance (`lib.rs:40`) — duplication notée dans l'[audit](../06-references/audit.md).

**Particularité — mode résident** : à la fermeture de la fenêtre principale, `api.prevent_close()` est appelé puis `win_clone.hide()` (`lib.rs:125-132`). Le binaire continue à tourner dans le tray. Quitter réellement passe par le menu "Quitter MiraMD" qui exécute `app.exit(0)` (`lib.rs:84-86`).

## Module `error.rs`

**Responsabilité** : type d'erreur unifié pour toutes les commandes [IPC](../01-decouverte/glossaire.md#ipc).

**Dépendances** : `serde` (pour la sérialisation), `thiserror` (pour la dérivation).

**Type principal** : `AppError`, un enum à 6 variantes (`error.rs:3-25`) :

| Variante | Source typique |
|---|---|
| `PathTraversal(String)` | Chemin contenant `..` (rejeté avant accès disque). |
| `InvalidPath(String)` | Chemin sans nom de fichier ou sans dossier parent. |
| `AlreadyExists(String)` | Création d'un fichier qui existe déjà (TOCTOU-safe). |
| `InvalidFilename(String)` | Nom de fichier contenant `/`, `\`, `..`, `.`, null bytes ou contrôle. |
| `ContentTooLarge(u64)` | Lecture > 50 MB ou parsing > 10 MB. |
| `Io(std::io::Error)` | Toutes les autres erreurs disque (via `#[from]`). |
| `Json(serde_json::Error)` | Erreur de (dé)sérialisation des préférences (via `#[from]`). |

**Sérialisation** (`error.rs:28-34`) : `impl Serialize for AppError` produit la string `to_string()`. Côté frontend, l'erreur arrive dans le `.catch()` d'un `invoke()` sous forme de string lisible — par exemple `"Path traversal rejected: /tmp/../etc/passwd"`.

## Module `filesystem.rs`

**Responsabilité** : toutes les opérations disque, avec validations de sécurité avant toute lecture/écriture.

**Dépendances** : `std::fs`, `std::io`, `std::path`. Pas de dépendance externe.

**Constantes** : `MAX_READ_SIZE = 50 * 1024 * 1024` (50 MB), définie ligne 7.

**Fonctions privées de validation** :

- `sanitize_path(path: &str) -> Result<PathBuf, AppError>` — `filesystem.rs:19-32`. Rejette tout chemin contenant un composant `ParentDir` (`..`), puis appelle `canonicalize()` qui résout les liens symboliques et exige que le chemin existe. Utilisée pour la lecture et le listing.
- `sanitize_write_path(path: &str) -> Result<PathBuf, AppError>` — `filesystem.rs:36-58`. Variante pour l'écriture : le fichier cible n'existe pas forcément, donc on canonicalize **uniquement le parent** et on rejoint avec le nom de fichier brut. Empêche un attaquant de poser un symlink vers `/etc/shadow` à l'emplacement de la cible.

**Commandes [IPC](../01-decouverte/glossaire.md#ipc) exposées** : voir le tableau ci-dessous.

**Structures de retour** :

- `FileInfo { path, name, content, size }` — `filesystem.rs:9-15`. Renvoyée par `read_file`.
- `DirectoryListing { entries, total }` — `filesystem.rs:181-186`, `#[serde(rename_all = "camelCase")]`. Renvoyée par `list_directory_entries`.
- `FileEntry { name, path, size, is_dir }` — `filesystem.rs:188-194`.

## Module `markdown.rs`

**Responsabilité** : convertir une string Markdown en HTML via [comrak](../01-decouverte/glossaire.md#comrak).

**Dépendances** : `comrak = "0.36"` avec la feature `syntect` (coloration syntaxique).

**Constantes** : `MAX_PARSE_SIZE = 10 * 1024 * 1024` (10 MB), ligne 5.

**Fonction publique** :

- `pub fn parse_markdown(content: &str) -> Result<String, AppError>` — `markdown.rs:8-32`. Vérifie la taille, configure `comrak::Options` avec les extensions GFM (`strikethrough`, `table`, `autolink`, `tasklist`, `footnotes`, `superscript`, `description_lists`, `math_dollars`, `math_code`), force `options.render.unsafe_ = false` (les balises `<script>`, `<iframe>` etc. sont strippées), puis appelle `markdown_to_html(content, &options)`.

Cette commande sert de fallback / outil utilitaire — l'édition WYSIWYG repose sur [Muya](../01-decouverte/glossaire.md#muya) côté frontend, pas sur cette fonction. Voir [`integration-muya.md`](integration-muya.md).

## Module `preferences.rs`

**Responsabilité** : schéma typé des préférences utilisateur, persistance JSON, validation des bornes.

**Dépendances** : `serde`, `serde_json`, `dirs` (pour le `config_dir` XDG-compliant), `std::fs`.

**Type principal** : `pub struct Preferences` — `preferences.rs:5-102`. ~50 champs couvrant tous les réglages : `theme`, `font_size`, `line_height`, `auto_save`, `tab_size`, `bullet_list_marker`, modes (`focus_mode`, `typewriter_mode`, `source_code_mode`, `read_only`...), thèmes Mermaid/Vega, etc. Le champ `prefs_version: u32` (default = 1) est déclaré pour préparer de futures migrations de schéma.

Toute la struct porte `#[serde(rename_all = "camelCase", default)]` : le JSON sur disque utilise du `camelCase` (compatible avec le frontend [TypeScript](../01-decouverte/glossaire.md#typescript)), et les champs absents ne font pas échouer la désérialisation — ils prennent leur valeur par défaut.

**Fonctions principales** :

- `fn validate_preferences(prefs: &mut Preferences)` — `preferences.rs:189-196`. Clamp **6 champs numériques** dans des bornes raisonnables : `font_size` ∈ [8, 72], `code_font_size` ∈ [8, 72], `line_height` ∈ [1.0, 3.0], `zoom` ∈ [0.5, 3.0], `auto_save_delay` ∈ [500, 60000], `tab_size` ∈ [1, 8].
- `fn prefs_path() -> PathBuf` — `preferences.rs:198-210`. Renvoie `<config_dir>/miramd/preferences.json`. Cascade de fallback : `dirs::config_dir()` → `home_dir/.config` → `/tmp` (avec un `log::warn!`).
- `pub fn load_preferences() -> Preferences` — `preferences.rs:212-232`. Lit le fichier, parse en JSON, fallback aux defaults si parsing échoue (avec `log::warn!`), valide.
- `pub fn save_preferences(mut prefs: Preferences) -> Result<(), AppError>` — `preferences.rs:234-250`. Valide, fait une **copie de backup** `.json.bak` si le fichier existe, puis écrit le JSON pretty-printed.

Tests : 6 tests unitaires (`test_default_preferences_are_valid`, `test_validate_clamps_extreme_values`, `test_serde_roundtrip`, `test_serde_missing_fields_use_defaults`, `test_serde_unknown_fields_ignored`, etc.) — voir `preferences.rs:252-322`.

## Tableau exhaustif des 9 commandes IPC

Toutes les commandes sont enregistrées dans `lib.rs:48-58` via `tauri::generate_handler!`.

| # | Nom | Signature Rust | Fichier:ligne | Description |
|---|---|---|---|---|
| 1 | `parse_markdown` | `parse_markdown(content: &str) -> Result<String, AppError>` | `markdown.rs:8-9` | Convertit du Markdown en HTML via [comrak](../01-decouverte/glossaire.md#comrak). Limite 10 MB. `unsafe_ = false`. |
| 2 | `read_file` | `read_file(path: &str) -> Result<FileInfo, AppError>` | `filesystem.rs:61-62` | Lit un fichier après validation du chemin. Limite 50 MB. Retourne `{path, name, content, size}`. |
| 3 | `write_file` | `write_file(path: &str, content: &str) -> Result<(), AppError>` | `filesystem.rs:89-90` | Écrit un fichier. Le parent est canonicalisé pour bloquer les symlinks. |
| 4 | `create_file` | `create_file(dir: &str, name: &str) -> Result<String, AppError>` | `filesystem.rs:99-100` | Crée un fichier vide via `OpenOptions::create_new` (atomique, pas de TOCTOU). Rejette les noms invalides. |
| 5 | `list_directory_entries` | `list_directory_entries(dir, offset: Option<usize>, limit: Option<usize>) -> Result<DirectoryListing, AppError>` | `filesystem.rs:135-140` | Liste un dossier (skip les entrées cachées). Tri : dossiers d'abord, puis nom alpha (case-insensitive). Pagination optionnelle. |
| 6 | `load_preferences` | `load_preferences() -> Preferences` | `preferences.rs:212-213` | Charge `~/.config/miramd/preferences.json`. Fallback aux defaults si absent ou corrompu. |
| 7 | `save_preferences` | `save_preferences(prefs: Preferences) -> Result<(), AppError>` | `preferences.rs:234-235` | Sauvegarde, avec backup automatique `.json.bak`. |
| 8 | `get_cli_file` | `get_cli_file(state: State<CliFile>) -> Option<String>` | `lib.rs:154-157` | Renvoie le fichier passé en argument de ligne de commande au démarrage (ou `None`). Lu une seule fois au mount du frontend. |
| 9 | `debug_log` | `debug_log(message: &str)` | `lib.rs:160-166` | Log côté Rust depuis le frontend. **No-op en release** grâce à `#[cfg(debug_assertions)]`. |

## Configuration Tauri (`tauri.conf.json`)

Le fichier vit dans [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json). Réglages essentiels :

| Clé | Valeur | Effet |
|---|---|---|
| `productName` | `"MiraMD"` | Nom du binaire et du bundle. |
| `identifier` | `"com.axel.miramd"` | Identifiant unique de l'application (pour macOS, Windows, etc.). |
| `version` | `"0.1.0"` | Version applicative. |
| `build.devUrl` | `"http://localhost:1420"` | URL servie par [Vite](../01-decouverte/glossaire.md#vite) en développement. |
| `build.frontendDist` | `"../build"` | Dossier de sortie [SvelteKit](#) (mode SPA via `adapter-static`). |
| `app.windows[0]` | `1200×800`, `decorations: false` | Fenêtre sans décorations (titre custom dans `TitleBar.svelte`). |
| `app.windows[0].minWidth/minHeight` | `480/555` | Bornes basses (ajustées dynamiquement quand un fichier est ouvert — voir `windowInit.ts`). |
| `app.security.csp` | voir [`securite.md`](securite.md) | [Content Security Policy](../01-decouverte/glossaire.md#csp) restrictive. |
| `bundle.targets` | `"all"` | Tous les formats de packaging activés : `.deb`, `.rpm`, `.AppImage`, `.dmg`, `.msi`, `.nsis`. |
| `bundle.fileAssociations` | `["md", "markdown", "mmd", "mdx", "mkd"]` | Associe ces extensions à MiraMD au niveau OS. |

## Capabilities — ce que la WebView a le droit de faire

Le fichier [`src-tauri/capabilities/default.json`](../../src-tauri/capabilities/default.json) déclare **explicitement** les permissions accordées à la fenêtre `main` (modèle [capabilities](../01-decouverte/glossaire.md#capability-tauri) de Tauri 2). Au-delà de ces permissions, **rien** n'est accessible depuis le frontend.

Permissions accordées :

- `core:default`, `core:event:default` — événements [IPC](../01-decouverte/glossaire.md#ipc).
- `core:window:default` + 11 permissions explicites : `allow-start-dragging`, `allow-minimize`, `allow-toggle-maximize`, `allow-is-maximized`, `allow-hide`, `allow-show`, `allow-set-focus`, `allow-start-resize-dragging`, `allow-set-min-size`, `allow-set-size`, `allow-inner-size`. Pas de fermeture programmatique de la fenêtre depuis le frontend.
- `opener:default` — ouvrir un lien externe via le browser système.
- `dialog:default` — ouvrir des dialogs natifs (open file, save, message).

**Pas accordé** : aucune permission `fs:*`. Le frontend ne peut donc pas lire ou écrire un fichier directement via le plugin `tauri-plugin-fs` — il **doit** passer par `read_file` / `write_file` qui valident le chemin côté Rust. C'est le pilier du modèle de sécurité, détaillé dans [`securite.md`](securite.md).

## Gestion d'erreurs

Pattern uniforme dans tout le backend :

1. Une opération qui peut échouer renvoie `Result<T, AppError>`.
2. Les erreurs `std::io::Error` et `serde_json::Error` sont converties automatiquement via `#[from]` (voir `error.rs:21,24`).
3. À l'intérieur d'une commande, on propage avec `?`.
4. À la frontière [IPC](../01-decouverte/glossaire.md#ipc), Tauri sérialise l'erreur grâce à `impl Serialize for AppError` (`error.rs:28-34`) — le frontend reçoit une string.
5. Côté frontend (`fileOperations.ts`), la string est logguée via `console.error` puis traduite en toast utilisateur via `showToast(...)`.

**Limite connue** : le frontend perd la variante exacte de l'erreur (toutes deviennent des strings). Pour les besoins actuels c'est suffisant ; un mapping plus fin pourrait être ajouté plus tard via un préfixe dans le message ou un type structuré.

## Logging

- **Crate** : `log` (façade) + `env_logger` (implémentation), initialisé dans `lib.rs:15-17` avec `default_filter_or("info")`.
- **Niveaux utilisés** : `info!` (démarrage, lecture/écriture), `warn!` (corruption JSON, échec backup, fallback `/tmp`), `debug!` (échecs d'événements de fenêtre).
- **`debug_log` IPC command** (`lib.rs:160-166`) : permet au frontend de logger côté Rust **uniquement en mode debug** (le `#[cfg(debug_assertions)]` rend la fonction no-op en release). Utilisé dans `MuyaPane.svelte` pour tracer les Ctrl+Z/Ctrl+Y interceptés.
- **Pas de fichier de log** : les logs vont vers `stderr` du process. Quand MiraMD est lancé en mode résident, ils ne sont visibles que si le binaire a été lancé depuis un terminal. Pour récupérer les logs en prod, lancer `RUST_LOG=debug miramd` depuis un terminal.

## Pour aller plus loin

- Le détail des validations de sécurité : [`securite.md`](securite.md).
- Comment ces commandes [IPC](../01-decouverte/glossaire.md#ipc) sont consommées côté frontend : [`frontend-svelte.md`](frontend-svelte.md) et [`flux-de-donnees.md`](flux-de-donnees.md).
- Le packaging du binaire et les jobs CI : [`build-et-packaging.md`](build-et-packaging.md).
