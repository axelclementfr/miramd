# Fonctionnalités

Cette section décrit, **fonction par fonction**, ce que MiraMD sait faire — du point de vue utilisateur d'abord, puis du code qui l'implémente. Chaque page est autonome : tu peux la lire seule.

Si un terme te paraît obscur, le [glossaire](../01-decouverte/glossaire.md) est là. Si tu veux le modèle mental d'ensemble, commence par [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md). Pour les bugs et limites recensés, voir [`06-references/problemes-connus.md`](../06-references/problemes-connus.md).

## Tableau récapitulatif

Légende des statuts :

- ✓ **stable** — fonctionne comme attendu, pas de bug ouvert.
- ⚠️ **instable** — fonctionne globalement, mais un ou plusieurs cas connus produisent des comportements inattendus. Voir le fichier de la fonctionnalité pour les détails.
- WIP — en cours de construction ou non finalisé.

| Fonctionnalité | Statut | Doc |
|---|---|---|
| Édition WYSIWYG (reconnaissance temps réel, auto-pairing, toolbar flottant, coloration code) | ✓ | [`edition-wysiwyg.md`](edition-wysiwyg.md) |
| Gestion de fichiers (ouvrir, créer, sauvegarder, fermer, auto-save) | ⚠️ | [`gestion-fichiers.md`](gestion-fichiers.md) |
| Onglets et historique undo/redo par onglet | ⚠️ | [`onglets-et-historique.md`](onglets-et-historique.md) |
| Préférences utilisateur (60+ options, persistance JSON) | ⚠️ | [`preferences.md`](preferences.md) |
| Thèmes (6 thèmes, switch dynamique) | ✓ | [`themes.md`](themes.md) |
| Internationalisation (8 langues) | ✓ | [`i18n.md`](i18n.md) |
| Table des matières (sidebar, sync scroll) | ⚠️ | [`table-des-matieres.md`](table-des-matieres.md) |
| Recherche dans le document (regex, casse, mot entier) | ✓ | [`recherche.md`](recherche.md) |
| Modes d'affichage (source, focus, machine à écrire, split, lecture seule) | ⚠️ | [`modes-affichage.md`](modes-affichage.md) |
| Zoom global responsive (Ctrl+molette, slider, indicateur status bar) + raccourcis heading | ✓ | [`zoom.md`](zoom.md) |

## Comment lire ces pages

Chaque page de fonctionnalité suit le même plan :

1. **Vue utilisateur** — ce que l'utilisateur voit ou fait, sans jargon. Si tu veux juste comprendre la fonctionnalité, c'est la seule section à lire.
2. **Implémentation** — composants [Svelte](../01-decouverte/glossaire.md#svelte), services, [stores](../01-decouverte/glossaire.md#store-svelte), commandes [IPC](../01-decouverte/glossaire.md#ipc) impliquées. Avec les chemins de fichiers exacts pour pouvoir aller lire le code.
3. **Pièges connus** — bugs ouverts (avec lien vers `problemes-connus.md`), choix questionnables, gotchas. Si rien n'est noté, c'est explicite.
4. **Pour aller plus loin** — liens vers la section architecture pour le contexte global.

## Ce que cette section ne contient pas

- **Les choix techniques** (Tauri vs Electron, Svelte vs Vue) → voir [`03-choix-techniques/`](../03-choix-techniques/).
- **L'architecture détaillée** (qui parle à qui, modules Rust, services frontend) → voir [`04-architecture/`](../04-architecture/).
- **L'inventaire des bugs ouverts** → voir [`06-references/problemes-connus.md`](../06-references/problemes-connus.md).
- **Les fonctionnalités d'édition internes à Muya** (gestion des tableaux, KaTeX, Mermaid) — elles sont héritées de [Muya](../01-decouverte/glossaire.md#muya) et documentées partiellement dans `muya.md` à la racine du projet.

## Si tu cherches une fonctionnalité qui n'est pas listée

Trois possibilités :

- **Elle est dans Muya** (par exemple : insertion d'image, équations, diagrammes Mermaid). MiraMD réutilise Muya tel quel — la fonctionnalité existe mais est documentée côté MarkText/Muya.
- **Elle n'est pas implémentée**. Voir [`06-references/problemes-connus.md`](../06-references/problemes-connus.md) pour les limites par design.
- **C'est un oubli de doc**. Ouvre une issue ou complète la doc.
