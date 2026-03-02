# Flux de données

Cette page décrit **ce qui se passe vraiment** quand l'utilisateur fait quelque chose, en suivant la donnée à travers les trois couches de MiraMD (Svelte / [Muya](../01-decouverte/glossaire.md#muya) / [Rust](../01-decouverte/glossaire.md#rust)). Si tu as compris [`vue-densemble.md`](vue-densemble.md) en synthèse, tu trouves ici les détails opérationnels.

Quatre scénarios sont décrits :

1. [Tu tapes une touche](#1-tu-tapes-une-touche)
2. [Tu ouvres un fichier](#2-tu-ouvres-un-fichier)
3. [Tu sauvegardes](#3-tu-sauvegardes)
4. [Tu changes de thème](#4-tu-changes-de-thème)

Pour chaque scénario : un schéma ASCII, puis les chemins de fichiers/lignes pour aller voir le code réel.

---

## 1. Tu tapes une touche

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   Clavier (touche pressée)                                         │
│        │                                                           │
│        ▼                                                           │
│   DOM contenteditable (fenêtre WebView)                            │
│        │                                                           │
│        ▼                                                           │
│   Muya — met à jour son rendu interne (Snabbdom diff DOM)          │
│        │   met à jour son historique undo                          │
│        │                                                           │
│        ▼                                                           │
│   editor.on('change', changes) ─── émis par Muya                   │
│        │                                                           │
│        ▼                                                           │
│   MuyaService.changeCallbacks[]  (services/muya.ts:73-75)          │
│        │                                                           │
│        ▼                                                           │
│   MuyaPane.svelte callback (lignes 91-114)                         │
│        │                                                           │
│        ├─ debounce 100 ms ──▶ editor.updateContent(tabId, md)      │
│        │                                                           │
│        └─ debounce 300 ms ──▶ updateStats(md, false)               │
│                                       │                            │
│                                       ▼                            │
│                                  editor.stats.set(...)             │
│                                                                    │
│   editor.updateContent déclenche aussi :                           │
│        │                                                           │
│        └── debouncedTocUpdate (300 ms) ──▶ editor.toc.set(...)     │
│            (extractHeadings via regex ^(#{1,6})\s+(.+))            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Étapes détaillées :

1. La touche atteint le `<div contenteditable>` que Muya gère (à l'intérieur de `MuyaPane.svelte`, dans `editorElement`).
2. Muya intercepte l'événement, calcule le diff Markdown, met à jour son DOM interne via [Snabbdom](../01-decouverte/glossaire.md#snabbdom), pousse l'opération dans son historique.
3. Muya émet `change` (avec un objet `changes` qui contient `markdown`).
4. Le bridge dans `services/muya.ts:73-75` (`editor.on('change', ...)`) parcourt `this.changeCallbacks[]` et invoque chaque callback inscrit.
5. `MuyaPane.svelte` a inscrit son callback dans `onMount` (`MuyaPane.svelte:91-114`). Il fait deux choses :
   - **Debounce 100 ms** sur `editor.updateContent(tabId, md)` — met à jour le store. Le `tabId` est capturé **avant** le timer (ligne 96) pour éviter qu'un changement de tab pendant le debounce ne pollue le mauvais onglet.
   - **Debounce 300 ms** sur `updateStats(md, false)` — recompte mots/chars/lignes/paragraphes (`services/stats.ts:36-56`).
6. `editor.updateContent` (`stores/editor.ts:88-96`) met à jour le tab dans le store **et** déclenche `debouncedTocUpdate(content)` avec un autre debounce de 300 ms qui pousse les nouveaux headings dans `editor.toc`.

À noter : si `loadingTab`, `readOnly`, ou `sourceCodeMode && !splitView`, le callback retourne sans rien faire (`MuyaPane.svelte:92-93`). Pas de double écriture dans ces cas.

L'auto-save tournera à part (boucle `setInterval` dans `services/autoSave.ts`) et déclenchera la sauvegarde au prochain tick si le tab est `isModified`.

---

## 2. Tu ouvres un fichier

Trois entrées possibles : `Ctrl+O`, le bouton "Ouvrir" du `WelcomeScreen`, ou un fichier passé en argument CLI (double-clic depuis le gestionnaire de fichiers).

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   Ctrl+O / clic / CLI arg                                          │
│        │                                                           │
│        ▼                                                           │
│   shortcuts.ts → handlers.openFile() (+page.svelte:101)            │
│        │                                                           │
│        ▼                                                           │
│   fileOperations.openFileDialog(tr)  (services/fileOperations.ts)  │
│        │                                                           │
│        ▼                                                           │
│   open({ multiple: true, filters: [...] })  ─── dialog Tauri       │
│        │                                                           │
│        ▼                                                           │
│   pour chaque chemin :                                             │
│        │                                                           │
│        ▼                                                           │
│   invoke('read_file', { path })  ─── IPC vers Rust                 │
│                  │                                                 │
│   ╔══════════════▼═══════════════════════════╗                     │
│   ║ src-tauri/src/filesystem.rs              ║                     │
│   ║   sanitize_path(path)                    ║                     │
│   ║      ├─ rejette '..'                     ║                     │
│   ║      └─ canonicalize() résout symlinks   ║                     │
│   ║   metadata.len() ≤ 50 MB ?               ║                     │
│   ║   fs::read_to_string(...)                ║                     │
│   ║   retourne FileInfo {path, name,         ║                     │
│   ║                      content, size}      ║                     │
│   ╚══════════════│═══════════════════════════╝                     │
│                  │                                                 │
│        ▼ (sérialisé en JSON via Serde)                             │
│   editor.addTab(file.path, file.name, file.content)                │
│        │                                                           │
│        │  -> tabs.push(...)                                        │
│        │  -> activeTabId.set(newId)                                │
│        │  -> toc.set(extractHeadings(content))                     │
│        │                                                           │
│        ▼                                                           │
│   editor.activeTab.subscribe (MuyaPane.svelte:127-158)             │
│        │                                                           │
│        ├─ historyCache.set(prevTabId, muya.getHistory())           │
│        ├─ muya.setMarkdown(tab.content)                            │
│        └─ muya.clearHistory() (pas de cache pour un nouveau tab)   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Étapes :

1. **Trigger** :
   - Raccourci : `+page.svelte:101` (`openFile: () => openFileDialog(tr)`).
   - CLI : `+page.svelte:84-89` appelle `invoke<string | null>('get_cli_file')` au mount, puis `openFileFromPath(cliFile, tr)` si non-null.
   - Single-instance (second lancement) : `lib.rs:37-44` émet `open-file` avec le chemin, `+page.svelte:92` listen et appelle `openFileFromPath`.
2. **Dialog ou chemin direct** : `openFileDialog` (`services/fileOperations.ts:19-40`) ouvre le picker natif via `@tauri-apps/plugin-dialog`. `openFileFromPath` (lignes 106-117) saute le dialog et utilise directement le chemin reçu.
3. **IPC** : `invoke<{path, name, content, size}>('read_file', { path })` traverse vers Rust.
4. **Validation Rust** (`filesystem.rs:62-86`) :
   - `sanitize_path(path)` rejette toute composante `ParentDir` (`..`), puis `canonicalize()` exige que le chemin existe et résout les symlinks.
   - `fs::metadata(...).len()` ≤ 50 MB sinon `AppError::ContentTooLarge`.
   - `fs::read_to_string(...)`.
   - Retourne `FileInfo` (sérialisé en JSON par [Serde](../01-decouverte/glossaire.md#serde)).
5. **Création du tab** : `editor.addTab(file.path, file.name, file.content)` (`stores/editor.ts:55-67`) pousse dans `tabs`, met `activeTabId`, et déclenche `toc.set(...)` immédiatement.
6. **MuyaPane réagit** : la subscription à `activeTab` (`MuyaPane.svelte:127-158`) détecte le changement et :
   - Sauvegarde l'historique du tab précédent dans `historyCache`.
   - Appelle `muya.setMarkdown(tab.content)` pour afficher le nouveau contenu.
   - Restaure l'historique si présent en cache, sinon `clearHistory()`.

En cas d'erreur (chemin invalide, taille dépassée, fichier introuvable), le `.catch()` dans `fileOperations.ts:34-37` log et appelle `showToast(tr('error_open_file'), 'error')`.

---

## 3. Tu sauvegardes (Ctrl+S)

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   Ctrl+S                                                           │
│        │                                                           │
│        ▼                                                           │
│   shortcuts.ts → handlers.saveFile() (+page.svelte:101)            │
│        │                                                           │
│        ▼                                                           │
│   fileOperations.saveCurrentFile(tr)                               │
│        │                                                           │
│        ▼                                                           │
│   tab = getCurrentTab()                                            │
│        │                                                           │
│        ▼                                                           │
│   content = muyaService.getMarkdown()  ◀── source de vérité Muya   │
│        │                                                           │
│        ▼                                                           │
│   tab.path existe ?                                                │
│        │                                                           │
│        ├─ NON ──▶ save({ filters, defaultPath: tab.name })         │
│        │              dialog Tauri pour choisir le chemin          │
│        │              puis : invoke('write_file', { path, content })│
│        │              + tabs.update(...) pour ré-attribuer path/name│
│        │                                                           │
│        └─ OUI ──▶ invoke('write_file', { path, content })          │
│                            │                                       │
│   ╔════════════════════════▼═════════════════════════╗             │
│   ║ src-tauri/src/filesystem.rs:89-95                ║             │
│   ║   sanitize_write_path(path)                      ║             │
│   ║     ├─ rejette '..'                              ║             │
│   ║     ├─ canonicalize() le PARENT                  ║             │
│   ║     └─ rejoint avec le filename brut             ║             │
│   ║       (anti-symlink)                             ║             │
│   ║   fs::write(&path_buf, content)                  ║             │
│   ║   Ok(())                                         ║             │
│   ╚════════════════════════│═════════════════════════╝             │
│                            │                                       │
│        ▼                                                           │
│   editor.markSaved(tab.id, content)                                │
│       └─ tab.savedContent = content, isModified = false            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Étapes :

1. Le raccourci est capté par `setupKeyboardShortcuts` (`services/shortcuts.ts:32-34`) qui appelle `handlers.saveFile()`.
2. `saveCurrentFile(tr)` (`services/fileOperations.ts:43-75`) :
   - Récupère `tab = getCurrentTab()`. Si `null`, retourne.
   - **Récupère le contenu depuis Muya, pas depuis le store** : `content = muyaService.getMarkdown()`. C'est important — le store n'est mis à jour que 100 ms après la dernière frappe. Si on sauvegarde immédiatement après une frappe, le store n'a peut-être pas encore le dernier caractère. Muya, lui, l'a.
   - Si `tab.path` existe (fichier déjà sauvé une fois) : `invoke('write_file', { path, content })`.
   - Sinon : ouvre le dialog `save({ filters, defaultPath: tab.name })`, puis `invoke('write_file', ...)` avec le chemin choisi, puis met à jour `tab.path` et `tab.name` via `tabs.update(...)`.
3. **Validation Rust** (`filesystem.rs:89-95`) :
   - `sanitize_write_path(path)` : rejette `..`, canonicalize **uniquement le parent** (le fichier cible peut ne pas exister), rejoint avec le filename brut. Empêche un attaquant de poser un symlink à l'emplacement.
   - `fs::write(...)`.
4. **Confirmation** : `editor.markSaved(tab.id, content)` (`stores/editor.ts:98-106`) met `savedContent = content` et `isModified = false`. La barre d'onglet retire le marqueur de modification.

En cas d'erreur, `.catch()` log et `showToast(tr('error_save_file'), 'error')`.

L'auto-save (`services/autoSave.ts`) suit le même chemin avec un trigger différent : un `setInterval` qui appelle `saveCurrentFile` toutes les `autoSaveDelay` ms si `preferences.autoSave && tab.isModified`.

---

## 4. Tu changes de thème

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│   Clic sur ThemeSection.svelte (radio "Sombre" / "Clair" / etc.)   │
│        │                                                           │
│        ▼                                                           │
│   preferences.patch({ theme: 'one-dark' })                         │
│        │                                                           │
│        ├─ update(current => ({ ...current, theme }))               │
│        │     └─ store interne mis à jour                           │
│        │                                                           │
│        └─ invoke('save_preferences', { prefs: updated })           │
│              └─ Rust écrit ~/.config/miramd/preferences.json       │
│                                                                    │
│   En parallèle, tous les abonnés au store réagissent :             │
│        │                                                           │
│        ▼                                                           │
│   +page.svelte subscribe (lignes 56-70) :                          │
│        ├─ document.documentElement.setAttribute('data-theme', 'one-dark')
│        ├─ document.body.style.setProperty('background-color',     │
│        │           THEME_BG_MAP['one-dark'] || DEFAULT_BG)         │
│        └─ document.documentElement.style.setProperty(              │
│              '--font-size', '...', '--line-height', ...)           │
│                                                                    │
│   MutationObserver dans app.html:33-37 détecte le data-theme :     │
│        └─ link#muya-theme.href = '/muya/theme-one-dark.css'        │
│                                                                    │
│   CSS recalculée :                                                 │
│        ├─ themes.css applique les variables (--bg-primary, etc.)   │
│        ├─ Muya theme-*.css applique les couleurs internes Muya     │
│        └─ Le rendu est mis à jour                                  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Étapes :

1. L'utilisateur clique sur un radio dans `SettingsModal.svelte → ThemeSection.svelte`. Le composant appelle `preferences.patch({ theme: 'one-dark' })`.
2. `patch` (`stores/preferences.ts:140-146`) :
   - Met à jour le store interne via `update(current => ({ ...current, ...partial }))`.
   - Lance `invoke('save_preferences', { prefs: updated })` en fire-and-forget (`.catch(...)` log seulement).
3. Côté Rust (`preferences.rs:234-250`) : `validate_preferences` clamp les bornes, écrit un `.json.bak`, puis `fs::write`.
4. **En parallèle** (les subscribers ont déjà reçu la nouvelle valeur dès `update`) :
   - `+page.svelte` (`+page.svelte:56-70`) : `setAttribute('data-theme', p.theme)`, met à jour `--font-size`, `--line-height`, `--font-family`, et `background-color` inline sur `<html>` et `<body>` depuis `THEME_BG_MAP`.
   - Le `MutationObserver` dans `app.html:33-37` détecte le changement de `data-theme` et change le `href` du `<link id="muya-theme">` vers la bonne feuille (`/muya/theme-{name}.css`).
   - Les CSS `themes.css` et `editor.css` sont écrites en termes de variables (`--bg-primary`, `--text-primary`, `--accent`...) que le sélecteur `html[data-theme='one-dark']` redéfinit.

Les composants qui ne s'abonnent pas explicitement au store **n'ont rien à faire** — les CSS variables changent et le rendu suit. C'est tout l'intérêt de la [réactivité](../01-decouverte/glossaire.md#réactivité) Svelte couplée à des CSS variables.

---

## Pour aller plus loin

- Le détail technique de chaque étape Rust : [`backend-rust.md`](backend-rust.md).
- Le détail technique de Muya et de ses callbacks : [`integration-muya.md`](integration-muya.md).
- Pourquoi le `unsafe-eval` est nécessaire et ce qu'il ouvre : [`securite.md`](securite.md).
