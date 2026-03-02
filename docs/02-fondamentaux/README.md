# Fondamentaux

Ce dossier explique les **concepts généraux** dont on a besoin pour comprendre comment MiraMD fonctionne. Il ne traite pas du code spécifique du projet (c'est le rôle de [`04-architecture/`](../04-architecture/)) mais des notions transverses qui reviennent partout.

Si tu lis la doc dans l'ordre, tu arrives ici après [`01-decouverte/`](../01-decouverte/). Si un terme te paraît obscur, va voir le [glossaire](../01-decouverte/glossaire.md).

## Ordre de lecture suggéré

L'ordre des fichiers ci-dessous va du plus contextuel au plus pointu. Tu peux aussi piocher au hasard selon ce qui te bloque.

| Fichier | Ce que tu apprends |
|---|---|
| [`application-desktop.md`](application-desktop.md) | La différence entre une app web, mobile et desktop. Pourquoi MiraMD est desktop. |
| [`framework.md`](framework.md) | Ce qu'est un framework, pourquoi on en utilise, différence avec une librairie. |
| [`compilation-vs-interpretation.md`](compilation-vs-interpretation.md) | Pourquoi Rust est compilé et JavaScript interprété, et ce que ça change. |
| [`runtime.md`](runtime.md) | Ce qu'est un runtime, pourquoi Tauri est plus léger qu'Electron. |
| [`wysiwyg.md`](wysiwyg.md) | "What You See Is What You Get" : édition WYSIWYG vs édition source, défis techniques. |
| [`ipc.md`](ipc.md) | Inter-Process Communication : pourquoi le frontend et le backend doivent se parler. |
| [`reactivite.md`](reactivite.md) | "Quand X change, Y se met à jour" : le mécanisme central de Svelte. |
| [`virtual-dom.md`](virtual-dom.md) | Le Virtual DOM en 5 minutes, et pourquoi Svelte n'en utilise pas. |

## Pour aller plus loin

Une fois ces concepts en tête :

- [`03-choix-techniques/`](../03-choix-techniques/) — pourquoi MiraMD a choisi tel framework / runtime / langage plutôt qu'un autre.
- [`04-architecture/`](../04-architecture/) — comment ces concepts se traduisent dans le code réel.
