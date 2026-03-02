# Architecture de MiraMD

Ce dossier décrit **comment MiraMD est construit en interne** : les couches, les modules, les flux de données, les choix de packaging. C'est la partie la plus technique de la documentation.

## À qui s'adresse cette section

À toi si tu veux **comprendre, contribuer ou auditer** le projet. Les autres dossiers (`01-decouverte`, `02-fondamentaux`, `03-choix-techniques`) répondent au "pourquoi". Celui-ci répond au "comment".

Pré-requis recommandés : avoir lu [`02-fondamentaux/`](../02-fondamentaux/) (qu'est-ce qu'un [framework](../01-decouverte/glossaire.md#framework), une [WebView](../01-decouverte/glossaire.md#webview), un [IPC](../01-decouverte/glossaire.md#ipc)) et survolé [`03-choix-techniques/`](../03-choix-techniques/) (pourquoi [Tauri](../01-decouverte/glossaire.md#tauri), [Svelte](../01-decouverte/glossaire.md#svelte), [Muya](../01-decouverte/glossaire.md#muya)).

## Ordre de lecture recommandé

1. **[`vue-densemble.md`](vue-densemble.md)** — Le modèle mental en 3 couches (UI Svelte / moteur Muya / backend Rust). À lire en premier ; tout le reste s'y adosse.
2. **[`backend-rust.md`](backend-rust.md)** — Modules Rust (`lib.rs`, `filesystem.rs`, `markdown.rs`, `preferences.rs`, `error.rs`), 9 commandes [IPC](../01-decouverte/glossaire.md#ipc), configuration Tauri, [capabilities](../01-decouverte/glossaire.md#capability-tauri).
3. **[`frontend-svelte.md`](frontend-svelte.md)** — Arbre de composants, [stores](../01-decouverte/glossaire.md#store-svelte), services [singletons](../01-decouverte/glossaire.md#singleton), routes.
4. **[`integration-muya.md`](integration-muya.md)** — Comment [Muya](../01-decouverte/glossaire.md#muya) est embarqué (vendoring, `window.Muya`), wrapper `MuyaService`, cycle de vie, événements interceptés.
5. **[`flux-de-donnees.md`](flux-de-donnees.md)** — Diagrammes ASCII des 4 scénarios principaux (taper, ouvrir, sauvegarder, changer de thème).
6. **[`securite.md`](securite.md)** — Modèle de sécurité : path traversal, limites de taille, [CSP](../01-decouverte/glossaire.md#csp), capabilities, audit [CI](#).
7. **[`build-et-packaging.md`](build-et-packaging.md)** — Du code source au `.deb`/`.dmg`/`.exe` : pipeline [Vite](../01-decouverte/glossaire.md#vite) + [Cargo](../01-decouverte/glossaire.md#cargo), CI/CD GitHub Actions, audit, pre-commit hooks.

## Notes de lecture

- Les chemins de fichier sont **toujours absolus** depuis la racine du dépôt (par exemple `src-tauri/src/lib.rs:48`).
- Les noms de fonctions et de modules sont écrits dans le code et **collent** à ce que tu trouveras réellement.
- Les liens `[terme](../01-decouverte/glossaire.md#ancre)` renvoient au [glossaire](../01-decouverte/glossaire.md) pour les concepts transverses.
- Si une section te paraît parachuter un terme sans contexte, c'est probablement qu'il est défini dans le glossaire.

## Pour aller au-delà

Une fois cette section lue, tu peux ouvrir n'importe quel fichier du dépôt et savoir **où il vit dans l'architecture**. Si tu cherches plutôt à contribuer, [`05-developpement/`](../05-developpement/) explique les workflows quotidiens (lancer en dev, écrire un test, ajouter une commande IPC).
