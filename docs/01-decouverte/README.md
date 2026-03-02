# Documentation de MiraMD

Bienvenue. Ce dossier `docs/` contient toute la documentation du projet : ce qu'est MiraMD, comment l'installer, comment il fonctionne en interne, et pourquoi telle ou telle techno a été choisie.

La doc est rangée par profondeur croissante. On commence par les concepts généraux (sans prérequis), puis on entre dans les détails techniques. Tu peux la lire de bout en bout, ou sauter directement à ce qui t'intéresse.

## Parcours selon ton profil

### Néophyte motivé — lecture linéaire

Tu débutes ou tu n'es pas développeur, mais tu veux comprendre. Suis l'ordre des dossiers :

1. **`01-decouverte/`** — c'est ici. Tu y apprends ce qu'est MiraMD, ce qu'est le Markdown, comment installer l'application.
2. **`02-fondamentaux/`** — les concepts généraux du logiciel utilisés partout après (framework, runtime, IPC, WYSIWYG, etc.).
3. **`03-choix-techniques/`** — les décisions structurantes du projet, sous forme d'[ADR](01-decouverte/glossaire.md#adr) (Tauri vs Electron, Svelte vs Vue/React, etc.).
4. **`04-architecture/`** — comment l'application est découpée à l'intérieur, qui parle à qui.
5. **`05-fonctionnalites/`** — chaque fonctionnalité visible décrite avec son fonctionnement interne.
6. **`06-references/`** — audit de sécurité, problèmes connus, journal des changements, et autres documents de référence.

À tout moment, le [glossaire](glossaire.md) est là pour expliquer les termes techniques.

### Développeur qui contribue — accès direct

Tu connais déjà le métier et tu veux creuser. Va directement dans :

- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — modèle mental complet en une page.
- [`04-architecture/`](../04-architecture/) — découpage par couche (backend, frontend, intégration Muya, sécurité, build).
- [`05-fonctionnalites/`](../05-fonctionnalites/) — implémentation de chaque feature.
- [`06-references/audit.md`](../06-references/audit.md) — état actuel du projet, dette technique, points d'attention.
- [`03-choix-techniques/`](../03-choix-techniques/) — historique des décisions ([ADRs](01-decouverte/glossaire.md#adr)).

### Pressé — vue d'ensemble en 10 minutes

- [README racine](../../README.md) — pitch, fonctionnalités, install rapide.
- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — les trois couches, le démarrage, où vivent les données.
- [`06-references/audit.md`](../06-references/audit.md) — santé du code et points connus.

## Comment c'est organisé

| Dossier | Contenu | Pour qui |
|---|---|---|
| [`01-decouverte/`](.) | Présentation, glossaire, installation, premier tour | Tout le monde |
| [`02-fondamentaux/`](../02-fondamentaux/) | Concepts logiciels génériques (framework, runtime, IPC, etc.) | Néophyte |
| [`03-choix-techniques/`](../03-choix-techniques/) | [ADRs](01-decouverte/glossaire.md#adr) : pourquoi Tauri, Svelte, Muya, comrak | Curieux et contributeurs |
| [`04-architecture/`](../04-architecture/) | Plan interne de l'application, par couche | Développeurs |
| [`05-fonctionnalites/`](../05-fonctionnalites/) | Détail fonctionnel et technique de chaque feature | Développeurs |
| [`06-references/`](../06-references/) | Audit, problèmes connus, changelog, références transverses | Mainteneurs |

## Conventions de la doc

- Chaque terme technique est lié au [glossaire](glossaire.md). Si tu vois un mot souligné, tu peux cliquer dessus.
- Les chemins de code (`src/lib/...`, `src-tauri/src/...`) sont relatifs à la racine du dépôt.
- Les exemples de commandes utilisent `npm` côté frontend et `cargo` côté [Rust](glossaire.md#rust). Le projet utilise [Tauri](glossaire.md#tauri) qui orchestre les deux via `npm run tauri ...`.

## Pour aller plus loin

Si tu débutes, ouvre [`quest-ce-que-miramd.md`](quest-ce-que-miramd.md). Si tu veux installer l'application tout de suite, va à [`installation.md`](installation.md). Si tu veux comprendre comment ça marche, commence par [`../04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md).
