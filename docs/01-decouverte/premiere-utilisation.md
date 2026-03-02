# Première utilisation

Cette page fait le tour rapide de MiraMD : ce que tu vois au premier lancement, comment créer et ouvrir des fichiers, comment naviguer entre les onglets, et les raccourcis indispensables. Avant de la lire, assure-toi que MiraMD est installé — voir [`installation.md`](installation.md).

## Premier lancement

Au démarrage, MiraMD ouvre une fenêtre avec :

- **Une barre latérale** à gauche, fine, qui donne accès à trois panneaux : l'arborescence de fichiers, la recherche dans le document, et la table des matières. Une icône d'engrenage tout en bas ouvre les paramètres.
- **Une barre d'onglets** en haut. Au lancement, un onglet vide est créé, prêt à recevoir du texte.
- **La zone d'édition** au centre, occupant la majorité de l'écran.
- **Une barre d'état** en bas, qui affiche des informations sur le document (nombre de mots, position du curseur) et des boutons pour basculer les modes d'affichage.

Pas de tutoriel imposé. Tu peux taper directement.

## Créer ou ouvrir un fichier

| Action | Raccourci |
|---|---|
| Nouveau fichier (nouvel onglet vide) | `Ctrl+N` |
| Ouvrir un fichier existant | `Ctrl+O` |

`Ctrl+O` ouvre le sélecteur de fichiers natif du système. Tu peux aussi **glisser-déposer** un fichier `.md` (ou `.markdown`, `.mmd`, `.mdx`, `.mkd`) directement dans la fenêtre.

Si tu as configuré MiraMD comme application par défaut pour les `.md` (voir [`installation.md`](installation.md)), tu peux aussi ouvrir un fichier en double-cliquant dessus depuis ton gestionnaire de fichiers.

## Modes WYSIWYG et source

MiraMD est en [WYSIWYG](glossaire.md#wysiwyg) par défaut : tu vois le rendu au fil de la frappe. Pour passer en **mode source** (afficher le Markdown brut), utilise le bouton dédié dans la barre d'état en bas, ou la case à cocher *Source code mode* dans les paramètres (`Ctrl+,` → onglet *View*). Il n'y a pas de raccourci clavier global pour cette bascule (à vérifier).

En mode source, tu peux activer la **vue scindée** : éditeur source à gauche, prévisualisation à droite, en synchronisation.

## Onglets

| Action | Raccourci |
|---|---|
| Créer un nouvel onglet (vide) | `Ctrl+N` |
| Fermer l'onglet courant | `Ctrl+W` |

Chaque onglet a son propre contenu, son propre fichier d'origine, et son propre historique d'annulation/rétablissement (`Ctrl+Z` / `Ctrl+Y`). Un point ou un astérisque dans l'onglet indique qu'il a été modifié et n'est pas encore sauvegardé.

Il n'existe pas (à ce jour) de raccourci `Ctrl+T` dédié à l'ouverture d'un onglet : la création d'un nouvel onglet passe par `Ctrl+N` ou par l'ouverture d'un fichier existant.

## Sauvegarde

| Action | Raccourci |
|---|---|
| Sauvegarder l'onglet courant | `Ctrl+S` |

Si l'onglet n'a pas encore de fichier associé (cas d'un onglet créé par `Ctrl+N`), une boîte de dialogue te demande où enregistrer.

### Sauvegarde automatique

MiraMD peut sauvegarder automatiquement à intervalle régulier. La fonctionnalité est désactivée par défaut. Pour l'activer :

1. `Ctrl+,` pour ouvrir les paramètres.
2. Section *General* (à vérifier).
3. Active *Auto save* et choisis le délai (5 secondes par défaut).

Tant qu'un onglet n'a pas de fichier associé, la sauvegarde automatique ne peut pas s'appliquer (rien à écrire) — sauvegarde-le manuellement une première fois avec `Ctrl+S`.

## Mode résident (icône dans le tray)

Quand tu fermes la fenêtre principale (croix de la fenêtre), MiraMD **ne s'arrête pas vraiment** : il reste actif en arrière-plan, avec une icône dans la zone de notification du système (tray). Cliquer sur l'icône rouvre instantanément la fenêtre — pas besoin de rallumer un nouveau processus.

Pour quitter complètement MiraMD :

1. **Clic droit** sur l'icône dans le tray.
2. Choisis **Quitter MiraMD** dans le menu.

Ce comportement est volontaire : il rend MiraMD aussi rapide à rouvrir qu'une note Post-it. Voir [`../04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) pour le détail.

## Raccourcis essentiels

Les raccourcis ci-dessous sont confirmés dans le code source ([`src/lib/services/shortcuts.ts`](../../src/lib/services/shortcuts.ts)) :

| Raccourci | Action |
|---|---|
| `Ctrl+N` | Nouveau fichier / nouvel onglet |
| `Ctrl+O` | Ouvrir un fichier |
| `Ctrl+S` | Sauvegarder |
| `Ctrl+W` | Fermer l'onglet courant |
| `Ctrl+,` | Ouvrir les paramètres |
| `Ctrl+B` | Basculer la barre latérale (sauf si le curseur est dans l'éditeur, auquel cas c'est *gras*) |
| `Ctrl++` | Zoom avant |
| `Ctrl+-` | Zoom arrière |
| `Ctrl+0` | Réinitialiser le zoom |

Les raccourcis d'édition (gérés directement par [Muya](glossaire.md#muya) à l'intérieur de la zone d'édition) :

| Raccourci | Action |
|---|---|
| `Ctrl+Z` | Annuler |
| `Ctrl+Y` ou `Ctrl+Shift+Z` | Rétablir |
| `Ctrl+B` | Texte en gras (à vérifier) |
| `Ctrl+I` | Texte en italique (à vérifier) |
| `Ctrl+A` | Tout sélectionner |
| `Ctrl+C` / `Ctrl+V` / `Ctrl+X` | Copier / coller / couper |

> Sur macOS, remplace `Ctrl` par `Cmd` (la touche commande).

## Préférences

`Ctrl+,` ouvre la fenêtre des paramètres. Elle est organisée en plusieurs sections (à vérifier les noms exacts) :

- **General** — sauvegarde automatique, langue de l'interface, comportement au démarrage.
- **Editor** — police, taille, hauteur de ligne, comportement de l'éditeur.
- **View** — mode source, vue scindée, mode focus, mode machine à écrire.
- **Markdown** — options du parser (notes de bas de page, mathématiques, etc.).
- **Theme** — choix parmi 6 thèmes (Light, Dark, One Dark, Graphite, Material Dark, Ulysses).

Les préférences sont stockées dans `~/.config/miramd/preferences.json` (Linux), avec un fichier de sauvegarde `.bak` au cas où le fichier principal serait corrompu. Voir [`../04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md).

## Pour aller plus loin

- [`../05-fonctionnalites/`](../05-fonctionnalites/) — détail de chaque fonctionnalité.
- [`../02-fondamentaux/wysiwyg.md`](../02-fondamentaux/wysiwyg.md) — comment fonctionne le mode WYSIWYG en interne.
- [`../06-references/problemes-connus.md`](../06-references/problemes-connus.md) — limitations actuelles.
