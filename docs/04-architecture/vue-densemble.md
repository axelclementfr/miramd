# Vue d'ensemble de l'architecture

Cette page donne le **modèle mental** de MiraMD : qui parle à qui, où vivent les données, comment l'application démarre. C'est le point d'entrée du dossier `04-architecture/`. Une fois cette page lue, les autres (`backend-rust.md`, `frontend-svelte.md`, etc.) prennent du sens individuellement.

## Les trois couches

MiraMD se compose de **trois couches** qui ont chacune une responsabilité distincte :

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   COUCHE 1 — Interface utilisateur (Svelte 5)           │
│   • Composants visibles : titre, onglets, barre latérale│
│   • Routes (une seule : /)                              │
│   • Stores : editor, preferences, toast                 │
│   • Services : muyaService, autoSave, fileOperations,   │
│     editorModes, shortcuts, zoom, etc.                  │
│                                                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ MuyaService (singleton — passerelle unique)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   COUCHE 2 — Moteur d'édition WYSIWYG (Muya)            │
│   • Vendored dans src/lib/muya/                         │
│   • Compilé en static/muya/index.min.js                 │
│   • Chargé comme script global window.Muya              │
│   • Gère : reconnaissance temps réel du Markdown,       │
│     historique undo/redo, événements clavier/souris     │
│                                                         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ IPC Tauri (invoke + listen)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   COUCHE 3 — Backend système (Rust + Tauri 2)           │
│   • src-tauri/src/                                      │
│   • Modules : lib, error, filesystem, markdown,         │
│     preferences                                         │
│   • 9 commandes IPC : read_file, write_file,            │
│     parse_markdown, load_preferences, etc.              │
│   • Validations sécurité (path traversal, taille)       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Pourquoi trois couches** ? Chacune a un métier distinct :

- La **couche 1** s'occupe de tout ce qui est visible et orchestrationnel. Elle ne sait rien lire ou écrire sur le disque.
- La **couche 2** est le moteur qui transforme du Markdown brut en édition WYSIWYG. Elle ne sait rien des préférences, des onglets, des fichiers.
- La **couche 3** est la seule qui touche au système d'exploitation : disque, dossier de configuration, parsing performant via [comrak](../01-decouverte/glossaire.md#comrak).

## Qui parle à qui

L'utilisateur tape une touche. Voici ce qui se passe (simplifié) :

1. La touche arrive dans un composant Svelte (`MuyaPane.svelte`).
2. Le composant relaie à **Muya** via `MuyaService`.
3. Muya met à jour son rendu et son historique interne.
4. Muya émet un événement `change`. `MuyaService` le propage aux callbacks enregistrés.
5. Les callbacks (dans `MuyaPane.svelte`) **debouncent** 100 ms puis mettent à jour le store `editor` (contenu de l'onglet courant).
6. L'auto-sauvegarde, qui tourne en boucle de fond, détecte que le contenu a changé. Au bon moment, elle appelle `invoke('write_file', { path, content })`.
7. La commande [IPC](../01-decouverte/glossaire.md#ipc) traverse vers le backend Rust.
8. Rust valide le chemin (`sanitize_write_path`), écrit le fichier, retourne un `Ok(())`.
9. La promise IPC se résout côté frontend.

Quand l'utilisateur **ouvre un fichier** :

1. Il choisit un fichier via un dialog Tauri (clic, glisser-déposer, ou raccourci `Ctrl+O`).
2. `fileOperations.openFile()` appelle `invoke('read_file', { path })`.
3. Rust ouvre, valide la taille (50 MB max), lit le contenu.
4. Le contenu remonte au frontend, qui crée un nouvel onglet dans le store `editor`.
5. Si c'est l'onglet actif, `MuyaPane.svelte` appelle `MuyaService.setMarkdown(content)`.
6. Muya parse le Markdown et affiche le rendu.

## Où vivent les données

| Donnée | Emplacement | Format |
|---|---|---|
| Documents Markdown ouverts | Disque utilisateur | `.md` ou similaire |
| Contenu de l'onglet courant | Mémoire (store `editor`) | string |
| Préférences utilisateur | `~/.config/miramd/preferences.json` | JSON validé par [Serde](../01-decouverte/glossaire.md#serde) |
| Backup des préférences | `~/.config/miramd/preferences.json.bak` | JSON |
| Historique undo/redo (Muya interne) | Mémoire (Muya) | format opaque |
| Snapshot d'historique par onglet | Mémoire (`historyCache`) | format opaque (snapshot Muya) |
| Toasts en cours | Mémoire (store `toast`) | tableau de `ToastMessage` |
| Cache du moteur Muya | Mémoire | maps internes (URL, code highlights, mermaid) |
| Position de la fenêtre | Pas persistée actuellement | — |

**Aucune base de données**. Aucune donnée envoyée à l'extérieur de la machine. MiraMD est strictement local-first.

## Démarrage de l'application

Voici la séquence simplifiée quand tu lances MiraMD :

1. Le système d'exploitation lance le binaire.
2. **Tauri** démarre : il crée une fenêtre native vide.
3. À l'intérieur de la fenêtre, **WebKitGTK** (Linux), **WKWebView** (macOS) ou **WebView2** (Windows) charge `index.html`.
4. `index.html` charge le bundle Svelte produit par Vite (le frontend).
5. **Svelte** monte le composant racine `+page.svelte`.
6. Le composant racine **subscribe** aux stores (`preferences`, `editor`, etc.) et applique les CSS variables (thème, font, line-height).
7. `+page.svelte` lance `MuyaPane.svelte`, qui appelle `MuyaService.init(...)`.
8. `MuyaService.init` lit les préférences, instancie `new MuyaClass(domElement, options)`. **Muya est prêt.**
9. Si un fichier était passé en argument de ligne de commande (`miramd ~/notes.md`), `+page.svelte` appelle `invoke('get_cli_file')` et l'ouvre.
10. L'utilisateur voit l'éditeur, prêt à recevoir des frappes.

Cette séquence prend environ **30 millisecondes** au démarrage à froid sur une machine récente — bien plus rapide qu'une app Electron qui doit démarrer Chromium.

## Mode résident (tray)

MiraMD reste dans la zone de notification quand on ferme la fenêtre principale. Du coup, **rouvrir une fenêtre est instantané** : la deuxième fois, on n'allume pas un nouveau processus, on rend juste la fenêtre visible.

Géré dans `src-tauri/src/lib.rs` (initialisation du tray icon + plugin single-instance Tauri). Quand l'utilisateur clique-droit sur l'icône → "Quitter MiraMD", le processus s'arrête vraiment.

## Pour aller plus loin

Maintenant que tu as le modèle mental, tu peux entrer dans le détail de chaque couche :

- **Backend Rust** → [`backend-rust.md`](backend-rust.md) — modules, commandes IPC, validations.
- **Frontend Svelte** → [`frontend-svelte.md`](frontend-svelte.md) — composants, stores, services.
- **Intégration Muya** → [`integration-muya.md`](integration-muya.md) — comment le moteur est embarqué et wrappé.
- **Flux de données** → [`flux-de-donnees.md`](flux-de-donnees.md) — diagrammes détaillés des principaux scénarios.
- **Sécurité** → [`securite.md`](securite.md) — modèle de sandbox, CSP, validations.
- **Build et packaging** → [`build-et-packaging.md`](build-et-packaging.md) — du code source au `.deb`.

Et si un terme te paraît obscur, le [glossaire](../01-decouverte/glossaire.md) est là.
