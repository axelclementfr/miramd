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
| **Frontend** | Vue 2 + moteur Muya custom | Svelte 5 + TipTap (ProseMirror) |
| **Parser** | marked.js (JS) | comrak (Rust, ~10-100x plus rapide) |
| **Taille .deb** | ~90 Mo | **5 Mo** |
| **Sécurité** | contextIsolation off, nodeIntegration on | Sandbox par défaut, CSP, IPC typé |
| **Réouverture** | ~800ms (nouveau process) | **~0ms** (mode résident) |

---

## Fonctionnalités

### Édition Markdown WYSIWYG
- **Reconnaissance temps réel** — `# ` → titre, `**texte**` → gras, `- ` → liste, `> ` → citation, ``` → code
- **Auto-pairing** — `*` → `**`, `` ` `` → ``` `` ```, `[` → `[]`, `(` → `()`, etc.
- **Preview syntaxe** — marqueurs markdown grisés visibles quand le curseur est sur du texte formaté
- **Icône de type de bloc** — icône MarkText dans la marge gauche (P, H1-H6, UL, OL, Quote, Code)
- **Toolbar flottant** — apparaît sur sélection de texte (gras, italique, souligné, barré, surligné, code, lien)
- **Tableaux** — redimensionnables, toolbar avec alignement/insertion/suppression lignes et colonnes
- **Coloration syntaxique** — 15 langages (JS, TS, Python, Rust, CSS, HTML, JSON, Bash, SQL, Java, C++, Go, YAML, Markdown, PHP)

### Modes d'affichage
- **Mode code source** — affiche le Markdown brut avec toutes les balises
- **Mode focus** — atténue tous les paragraphes sauf celui du curseur
- **Mode machine à écrire** — garde le curseur au centre vertical de l'écran
- **Vue scindée** — en mode source, affiche éditeur et preview côte à côte

### Interface
- **6 thèmes** — Light, Dark, One Dark, Graphite, Material Dark, Ulysses
- **8 langues** — Français, English, Español, Deutsch, Italiano, Português, 日本語, 中文
- **Sidebar MarkText-style** — barre d'icônes (fichiers, recherche, table des matières) + paramètres en bas
- **Table des matières** — arbre dépliable avec flèches, clic pour naviguer vers le titre
- **Recherche** — dans le document avec options casse/regex, navigation entre résultats
- **Onglets** — fichiers multiples avec indicateur de modification
- **Paramètres** — modale moderne avec navigation par sections

### Performance
- **Mode résident** — quand la fenêtre est fermée, MiraMD reste dans le tray système. Réouverture instantanée (~0ms)
- **Instance unique** — double-clic sur un 2e .md → ouvre dans l'instance existante au lieu de relancer
- **Bundle optimisé** — 734 KB frontend (lowlight sélectif au lieu de toutes les langues)
- **Pas de flash blanc** — fond sombre inline dans le HTML avant le chargement JS

### Sécurité
- **Sandbox Tauri** — le frontend n'a pas accès à Node.js
- **CSP configurée** — Content Security Policy restrictive
- **IPC typé** — commandes Rust avec validation serde à la désérialisation
- **Pas de nodeIntegration** — contrairement à MarkText

---

## Architecture

```
MiraMD/
├── src/                         # Frontend (Svelte 5 + TypeScript)
│   ├── lib/
│   │   ├── components/ (9)      # Editor, Sidebar, TabBar, StatusBar, SettingsModal,
│   │   │                        # BubbleToolbar, FrontMenu, SlashMenu
│   │   ├── extensions/ (5)      # BlockTypeIndicator, AutoPairMarkdown, TableToolbar,
│   │   │                        # MarkdownSyntaxDecorator, MarkdownHint
│   │   ├── stores/ (2)          # editor.ts, preferences.ts
│   │   ├── i18n/ (1)            # Système de traduction (8 langues)
│   │   └── styles/ (3)          # global.css, themes.css, editor.css
│   └── routes/                  # +page.svelte (app principale)
│
├── src-tauri/src/               # Backend (Rust)
│   ├── lib.rs                   # Setup Tauri, tray icon, single instance, CLI
│   ├── markdown.rs              # Parser comrak (GFM, footnotes, math)
│   ├── filesystem.rs            # File I/O, listing répertoires
│   └── preferences.rs           # Préférences JSON (serde + defaults)
│
└── static/icons/                # Icônes PNG de MarkText
```

**Flux de données :**
```
Saisie utilisateur → TipTap (Svelte) → IPC Tauri → Commandes Rust → Réponse → Stores Svelte → UI
```

---

## Installation (Ubuntu/Debian)

### Depuis les sources

```bash
# Prérequis: Rust (stable), Node.js (v20+), dépendances Tauri
cd MiraMD
npm install
npm run tauri build
sudo dpkg -i src-tauri/target/release/bundle/deb/MiraMD_0.1.0_amd64.deb
```

### Définir comme application par défaut pour les .md

```bash
xdg-mime default MiraMD.desktop text/markdown
```

### Désinstallation

```bash
sudo dpkg -r miramd
```

---

## Développement

```bash
npm run tauri dev      # Mode dev complet (frontend + backend + hot reload)
npm run dev            # Serveur Vite seul (frontend)
npm run build          # Build production frontend
npm run tauri build    # Build production complet (.deb, .rpm)
npm run check          # Vérification types TypeScript / Svelte
```

---

## Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Ctrl+N` | Nouveau fichier |
| `Ctrl+O` | Ouvrir un fichier |
| `Ctrl+S` | Sauvegarder |
| `Ctrl+W` | Fermer l'onglet |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Paramètres |
| `Ctrl+F` | Recherche (via sidebar) |
| `# ` | Titre 1 (et `##`, `###`, etc.) |
| `**texte**` | Gras |
| `*texte*` | Italique |
| `` `code` `` | Code inline |
| `- ` | Liste à puces |
| `1. ` | Liste numérotée |
| `- [ ] ` | Liste de tâches |
| `> ` | Citation |
| `---` | Ligne horizontale |
| `Tab` | Cellule suivante (dans un tableau) |

---

## Licence

MIT
