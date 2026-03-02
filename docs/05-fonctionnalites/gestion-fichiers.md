# Gestion de fichiers

Toutes les opérations qui touchent au disque : ouvrir un fichier existant, créer un nouveau document vide, sauvegarder, fermer un onglet. C'est la couche de pont entre les onglets affichés à l'écran et les fichiers `.md` réels du disque.

## Vue utilisateur

**Ouvrir un fichier.**

- `Ctrl+O` ouvre la boîte de dialogue native de l'OS, filtrée sur les extensions Markdown (`.md`, `.markdown`, `.mmd`, `.mdx`, `.mkd`). Tu peux sélectionner plusieurs fichiers à la fois — chaque fichier devient un nouvel onglet.
- Glisser-déposer un fichier `.md` depuis l'explorateur sur la fenêtre MiraMD ouvre le fichier dans un nouvel onglet.
- Lancer MiraMD depuis un terminal avec un chemin (`miramd ~/notes.md`) ouvre directement ce fichier au démarrage. Si MiraMD est déjà ouvert, le fichier est ajouté à l'instance existante (mode "instance unique").
- Double-cliquer sur un fichier `.md` depuis le gestionnaire de fichiers de l'OS, après avoir associé MiraMD comme application par défaut, ouvre le fichier dans MiraMD.

**Créer un nouveau document.**

- `Ctrl+N` ajoute un onglet "Untitled.md" vide. Aucun fichier n'est créé sur disque tant que tu ne sauvegardes pas.

**Sauvegarder.**

- `Ctrl+S` enregistre le contenu de l'onglet actif vers son fichier de référence sur disque.
- Si l'onglet n'a jamais été sauvegardé (document "Untitled"), la boîte de dialogue native s'ouvre pour te demander où enregistrer et sous quel nom (équivalent "Sauvegarder sous").
- Une fois sauvegardé, l'onglet perd son indicateur de modification (l'astérisque à côté du nom disparaît).

**Fermer un onglet.**

- `Ctrl+W` ferme l'onglet actif.
- Si l'onglet a des modifications non sauvegardées (`isModified === true`), une boîte de dialogue propose trois options : **Sauvegarder**, **Annuler les modifications** (discard), **Annuler** (cancel — l'onglet reste ouvert).
- À la fermeture de la fenêtre principale, MiraMD reste résident dans le tray (cf. [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) section "Mode résident"). Pour quitter vraiment, clic-droit sur l'icône de tray → "Quitter".

**Auto-save.**

- Désactivé par défaut. Activable depuis les [préférences](preferences.md) (panneau "Général").
- Quand actif, MiraMD écrit le contenu de l'onglet courant sur disque toutes les `autoSaveDelay` millisecondes (5 000 ms par défaut, configurable). Si l'onglet n'a jamais été sauvegardé (pas de chemin de fichier), rien ne se passe — l'auto-save n'invente pas de chemin.
- En arrière-plan, un second timer poll toutes les 2 secondes pour détecter si tu changes l'intervalle dans les préférences.

## Implémentation

**Composants Svelte concernés** :

- `src/lib/components/TabBar.svelte` — la barre d'onglets en haut. Bouton "+" pour nouveau document, croix sur chaque onglet pour fermer.
- `src/routes/+page.svelte` — orchestre les raccourcis `Ctrl+O`, `Ctrl+S`, `Ctrl+N`, `Ctrl+W` via `setupKeyboardShortcuts()`. Configure aussi les listeners IPC pour les événements de drag-drop et de single-instance.

**Services concernés** :

- `src/lib/services/fileOperations.ts` — toutes les opérations de fichier exposées au frontend :
  - `openFileDialog(tr)` : ouvre la boîte de dialogue, lit chaque fichier sélectionné via [IPC](../01-decouverte/glossaire.md#ipc), crée un onglet par fichier.
  - `openFileFromPath(path, tr)` : ouvre un fichier dont on connaît déjà le chemin (CLI, drag-drop, single-instance).
  - `saveCurrentFile(tr)` : récupère le markdown courant via `MuyaService.getMarkdown()`, appelle `invoke('write_file', { path, content })`. Si pas de chemin, ouvre la dialogue "Sauvegarder sous".
  - `closeTabWithConfirm(id, tr)` : si l'onglet est modifié, dialogue 3 boutons (oui = save, non = discard, cancel).
- `src/lib/services/autoSave.ts` — `startAutoSave(getPrefs, saveCallback)` : démarre un `setInterval` configurable, plus un second timer (2 s) qui surveille les changements de préférences pour redémarrer le timer principal.
- `src/lib/services/shortcuts.ts` — `setupKeyboardShortcuts()` : enregistre les raccourcis clavier globaux. Les raccourcis de l'éditeur (Ctrl+Z, Ctrl+A) sont gérés à part dans `MuyaPane.svelte` (cf. [`onglets-et-historique.md`](onglets-et-historique.md)).

**Backend Rust impliqué — commandes [IPC](../01-decouverte/glossaire.md#ipc)** :

- `read_file(path: String) -> { path, name, content, size }` (`src-tauri/src/filesystem.rs`) — ouvre le fichier, valide la taille (max 50 MB, sinon erreur), retourne le contenu en UTF-8.
- `write_file(path: String, content: String) -> ()` — écrit le contenu sur disque. Valide d'abord le chemin via `sanitize_write_path()` (canonicalize parent + filename, rejette les `..`, les noms invalides, etc.).
- `create_file(path: String) -> ()` — crée un fichier vide avec `OpenOptions::create_new(true)`, ce qui élimine la condition de course (TOCTOU).
- `list_directory_entries(path, offset, limit)` — listing d'un répertoire, paginé (utilisé par le pane "Files" de la sidebar).

Toutes ces commandes retournent un `Result<T, AppError>` que [Serde](../01-decouverte/glossaire.md#serde) sérialise en `string` côté frontend en cas d'erreur.

**Stores impactés** :

- `editor.tabs` — `addTab(path, name, content)` ajoute un onglet, `closeTab(id)` retire, `markSaved(id, content)` marque comme sauvegardé.
- `editor.activeTabId` — change automatiquement à la fermeture de l'onglet courant (passe à l'onglet voisin).
- `toast` — pour notifier les erreurs (`error_open_file`, `error_save_file`).

## Pièges connus

- **Sauvegarde silencieuse en cas d'échec** ⚠️ : la commande `write_file` est appelée en *fire-and-forget* dans certains chemins. Si Rust retourne une erreur (permissions, disque plein, fichier verrouillé, path traversal détecté), le `.catch()` log dans la console mais l'utilisateur n'a pas toujours de toast. Un onglet peut donc être marqué "saved" alors que rien n'a été écrit. Voir [`problemes-connus.md#sauvegarde-silencieuse--pas-de-feedback-en-cas-déchec`](../06-references/problemes-connus.md#sauvegarde-silencieuse--pas-de-feedback-en-cas-déchec).
- **Pas de retry** : en cas d'échec, l'auto-save ne réessaye pas. Le prochain tick (5 s plus tard par défaut) retentera, mais sans aucune notification de l'échec précédent.
- **Pas de détection des changements externes** : si tu modifies un fichier ouvert depuis un autre éditeur (ou via `git pull`), MiraMD ne le détecte pas. Aucun watcher n'est branché sur les fichiers en cours d'édition. À la prochaine sauvegarde, MiraMD écrasera la version externe sans avertissement.
- **Pas de timeout sur l'IPC** : si `write_file` se fige (réseau distant lent, FUSE non répondant), l'UI peut figer sans feedback. Voir [`problemes-connus.md`](../06-references/problemes-connus.md) section "Pas de timeout IPC".
- **Pas d'idempotence** : l'auto-save écrit même si `content === savedContent`. Sur un disque réseau lent, ça peut générer du trafic inutile. Piste de fix mentionnée dans `problemes-connus.md`.
- **Limite de 50 MB en lecture** : volontaire (anti-DOS), mais peut surprendre sur des fichiers Markdown très gros (cas rare).

## Pour aller plus loin

- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — schéma général du flux "ouvrir un fichier" et "sauvegarder".
- [`04-architecture/backend-rust.md`](../04-architecture/backend-rust.md) — détails sur `filesystem.rs`, `sanitize_path()`, `sanitize_write_path()`, validations.
- [`04-architecture/securite.md`](../04-architecture/securite.md) — le modèle de [sandbox](../01-decouverte/glossaire.md#sandbox) [Tauri](../01-decouverte/glossaire.md#tauri), les [capabilities](../01-decouverte/glossaire.md#capability-tauri) accordées au frontend.
- [`onglets-et-historique.md`](onglets-et-historique.md) — comment plusieurs fichiers ouverts en parallèle sont orchestrés.
