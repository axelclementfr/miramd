# MiraMD

**Un éditeur Markdown minimal et élégant, construit avec Rust et Tauri.**

MiraMD est une réécriture complète de [MarkText](https://github.com/marktext/marktext) — reconstruit de zéro avec une architecture moderne, performante et sécurisée. Le nom vient du latin *mira* (merveilleux) + *MD* (Markdown).

---

## Pourquoi MiraMD ?

MarkText est un excellent éditeur Markdown, mais il repose sur Electron 18 (fin de vie depuis 2022), Vue 2 (maintenance uniquement), et un moteur d'édition custom (Muya) de ~15 000+ lignes de JavaScript. Il présente aussi des failles de sécurité critiques (context isolation désactivé, nodeIntegration activé, pas de CSP).

| | MarkText | MiraMD |
|---|---|---|
| **Runtime** | Electron 18 (~300 Mo RAM) | Tauri 2 (~30 Mo RAM) |
| **Backend** | Node.js | Rust |
| **Frontend** | Vue 2 | Svelte 5 + Muya WYSIWYG |
| **Parser** | marked.js (JS) | comrak (Rust, ~10-100x plus rapide) |
| **Taille .deb** | ~90 Mo | **5 Mo** |
| **Sécurité** | contextIsolation off, nodeIntegration on | Sandbox par défaut, CSP, IPC typé |
| **Réouverture** | ~800ms (nouveau process) | **~0ms** (mode résident) |

---

## Documentation

La documentation détaillée se trouve dans [`docs/`](docs/), organisée en 6 dossiers numérotés pour une lecture progressive.

- **Tu découvres MiraMD** → commence par [`docs/01-decouverte/`](docs/01-decouverte/) puis avance dans l'ordre.
- **Tu veux contribuer ou comprendre le code** → [`docs/04-architecture/`](docs/04-architecture/) et [`docs/05-fonctionnalites/`](docs/05-fonctionnalites/).
- **Tu veux juger l'état du projet** → [`docs/06-references/audit.md`](docs/06-references/audit.md) (audit complet) et [`docs/06-references/problemes-connus.md`](docs/06-references/problemes-connus.md) (bugs identifiés).
- **Un terme te paraît obscur** → [`docs/01-decouverte/glossaire.md`](docs/01-decouverte/glossaire.md).

---

## Fonctionnalités

### Édition Markdown WYSIWYG
- **Reconnaissance temps réel** — `# ` → titre, `**texte**` → gras, `- ` → liste, `> ` → citation, ``` → code
- **Auto-pairing** — `*` → `**`, `` ` `` → ``` `` ```, `[` → `[]`, `(` → `()`, etc.
- **Preview syntaxe** — marqueurs markdown grisés visibles quand le curseur est sur du texte formaté
- **Icône de type de bloc** — icône dans la marge gauche (P, H1-H6, UL, OL, Quote, Code)
- **Toolbar flottant** — apparaît sur sélection de texte (gras, italique, souligné, barré, surligné, code, lien)
- **Tableaux** — redimensionnables, toolbar avec alignement/insertion/suppression lignes et colonnes
- **Coloration syntaxique** — via syntect (Rust) dans les blocs de code

### Modes d'affichage
- **Mode code source** — affiche le Markdown brut avec toutes les balises
- **Mode focus** — atténue tous les paragraphes sauf celui du curseur
- **Mode machine à écrire** — garde le curseur au centre vertical de l'écran
- **Vue scindée** — en mode source, affiche éditeur et preview côte à côte
- **Mode lecture seule** — verrouille l'édition

### Interface
- **6 thèmes** — Light, Dark, One Dark, Graphite, Material Dark, Ulysses
- **8 langues** — Français, English, Español, Deutsch, Italiano, Português, 日本語, 中文
- **Sidebar MarkText-style** — barre d'icônes (fichiers, recherche, table des matières) + paramètres en bas
- **Table des matières** — arbre dépliable avec flèches, clic pour naviguer vers le titre
- **Recherche** — dans le document avec options casse/mot entier/regex, navigation entre résultats
- **Onglets** — fichiers multiples avec indicateur de modification, historique undo/redo par onglet
- **Paramètres** — modale avec navigation par sections (thème, général, éditeur, vue, markdown)

### Performance
- **Mode résident** — quand la fenêtre est fermée, MiraMD reste dans le tray système. Réouverture instantanée
- **Instance unique** — double-clic sur un 2e .md → ouvre dans l'instance existante
- **Auto-save** — sauvegarde automatique configurable
- **Pas de flash blanc** — fond sombre inline dans le HTML avant le chargement JS

### Sécurité
- **Sandbox Tauri** — le frontend n'a pas accès à Node.js
- **CSP configurée** — Content Security Policy restrictive
- **IPC typé** — commandes Rust avec validation serde à la désérialisation
- **Protection path traversal** — canonicalisation, validation des chemins, création atomique de fichiers
- **Filtrage CLI** — seuls les fichiers markdown sont acceptés via ligne de commande
- **Audit de sécurité en CI** — `npm audit` + `cargo audit` automatiques

---

## Architecture

```
MiraMD/
├── src/                          # Frontend (Svelte 5 + TypeScript)
│   ├── lib/
│   │   ├── components/           # 21 composants Svelte
│   │   │   ├── editor/           # EditorContainer, MuyaPane, SourcePane, LockToggle
│   │   │   ├── settings/         # SettingsModal + 5 sections
│   │   │   └── sidebar/          # Sidebar, FileTreePane, SearchPane, TocPane
│   │   ├── services/             # 9 services (muya, fileOperations, shortcuts,
│   │   │                         #   autoSave, editorModes, stats, zoom, etc.)
│   │   ├── stores/               # editor, preferences, toast
│   │   ├── i18n/                 # 8 langues
│   │   └── styles/               # global.css, themes.css, editor.css
│   └── routes/                   # +page.svelte (orchestrateur)
│
├── src-tauri/src/                # Backend (Rust)
│   ├── lib.rs                    # Setup Tauri, tray icon, single instance, CLI
│   ├── markdown.rs               # Parser comrak (GFM, footnotes, math)
│   ├── filesystem.rs             # File I/O, listing répertoires, sécurité path
│   ├── preferences.rs            # Préférences JSON (serde + validation + backup)
│   └── error.rs                  # AppError enum (7 variantes)
│
└── static/muya/                  # Éditeur Muya WYSIWYG (assets pré-compilés)
```

**Flux de données :**
```
Saisie utilisateur → Muya (WYSIWYG) → MuyaService → Stores Svelte → IPC Tauri → Rust → Réponse → UI
```

---

## Installation

Instructions complètes (Linux, macOS, Windows, build from source) : [`docs/01-decouverte/installation.md`](docs/01-decouverte/installation.md).

Quick start Ubuntu/Debian depuis les sources :

```bash
cd MiraMD
npm install
npm run tauri build
sudo dpkg -i src-tauri/target/release/bundle/deb/MiraMD_0.1.0_amd64.deb
```

---

## Développement

```bash
npm run tauri dev      # Mode dev complet (frontend + backend + hot reload)
npm run dev            # Serveur Vite seul (frontend)
npm run build          # Build production frontend
npm run tauri build    # Build production complet (.deb, .AppImage, .dmg, .msi)
npm run check          # Vérification types TypeScript / Svelte
npm run test           # Tests (164 frontend + 28 Rust)
npm run lint           # Linting via Biome
```

---

## Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Ctrl+N` | Nouveau fichier |
| `Ctrl+O` | Ouvrir un fichier |
| `Ctrl+S` | Sauvegarder |
| `Ctrl+W` | Fermer l'onglet |
| `Ctrl+Z` | Annuler |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Rétablir |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Paramètres |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Zoom avant / arrière / réinitialiser |

---

## Licence

MIT — voir [LICENSE](LICENSE)
