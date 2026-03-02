# Virtual DOM

Le [Virtual DOM](../01-decouverte/glossaire.md#virtual-dom) (souvent abrégé VDOM) est une **représentation en mémoire du DOM**, sur laquelle on travaille avant d'appliquer les changements à la vraie page web. C'est une technique qui a popularisé React, et qu'on retrouve dans Vue et dans [Snabbdom](../01-decouverte/glossaire.md#snabbdom). Mais ce n'est pas la seule façon de faire — et ce n'est pas celle qu'utilise [Svelte](../01-decouverte/glossaire.md#svelte).

## Rappel : qu'est-ce que le DOM

Le [DOM](../01-decouverte/glossaire.md#dom) (*Document Object Model*) est l'arborescence d'éléments que le navigateur dessine à l'écran : `<div>`, `<p>`, `<h1>`, `<button>`. Le code JavaScript peut ajouter, modifier ou supprimer ces éléments en cours d'exécution.

**Manipuler le DOM est lent**. Chaque modification déclenche potentiellement un recalcul de mise en page, un repaint, une mise à jour des animations. Si tu changes 500 éléments à la suite, tu peux faire ramer la page.

## L'analogie du déménagement

Imagine que tu doives réorganiser ton appartement. Deux stratégies possibles :

- **Sans plan** : tu déplaces le canapé, tu te rends compte qu'il bloque la porte, tu le redéplaces, tu pousses la table, elle gêne le passage, tu la repousses. Tu portes du poids inutilement, tu te fatigues, ça prend des heures.
- **Avec un plan** : tu prends une feuille, tu dessines la pièce vide, tu places les meubles sur le papier, tu vérifies que tout passe. Une fois le plan validé, tu déplaces chaque meuble **une seule fois**, à sa place finale.

Le Virtual DOM, c'est le plan sur papier. On fait toutes les hésitations en mémoire, dans un objet JavaScript pur (rapide à manipuler), et on n'écrit dans le vrai DOM (lent) que la différence finale.

## Comment ça marche concrètement

Le cycle classique d'un framework à VDOM :

1. **L'état change**. Une variable passe de `10` à `15`.
2. Le framework **reconstruit un arbre virtuel** : un objet JavaScript qui décrit à quoi devrait ressembler le DOM si on le redessinait depuis zéro.
3. Le framework **compare** (on dit *diff*) cet arbre virtuel avec celui de l'étape précédente.
4. Il en déduit la **liste minimale de modifications** à appliquer (par exemple : "changer le texte du `<span>` numéro 3").
5. Il applique **ces seules modifications** au vrai DOM.

Résultat : on évite de toucher au DOM pour rien. Là où une approche naïve repeindrait toute la page, le VDOM ne touche qu'aux éléments effectivement modifiés.

C'est l'approche de **React** (depuis 2013), de **Vue** (par défaut), et de **Snabbdom** (la petite bibliothèque utilisée à l'intérieur de Muya).

## La particularité Svelte : pas de Virtual DOM

Svelte fait un pari différent : **se passer du Virtual DOM** entièrement.

L'idée tient à un mot : **compilation**. Svelte est un framework compilé (voir [`02-fondamentaux/compilation-vs-interpretation.md`](compilation-vs-interpretation.md)). Au moment du build, Svelte lit ton composant et **comprend précisément** quelles parties du DOM dépendent de quelles variables.

Plutôt que d'embarquer une bibliothèque qui fera des comparaisons d'arbres au runtime, Svelte génère du code JavaScript qui, quand telle variable change, **modifie directement le bon nœud du DOM**. Pas d'arbre virtuel à construire, pas de diff à calculer. Juste l'instruction minimale.

L'analogie : le VDOM, c'est tracer un plan à chaque déménagement. Svelte, c'est avoir un déménageur qui a appris la disposition de ton appart par cœur — il sait quoi déplacer où, sans plan.

### Pourquoi c'est possible

Svelte peut se le permettre parce qu'au compile-time, il a accès au code source complet du composant. Il sait quelles variables existent, quelles parties du template les utilisent, quelles modifications sont possibles. Un framework qui s'exécute au runtime (comme React sans son compilateur) doit faire ce travail à chaque rendu.

### Quel est le gain

- **Bundle plus léger** : pas de bibliothèque VDOM embarquée. Le code Svelte compilé est minimal.
- **Performance** : pas de phase de diff à exécuter. Les mises à jour sont directes.
- **Simplicité mentale** : le développeur écrit "quand cette variable change, ce texte se met à jour", et c'est exactement ce qui se passe.

Le revers : Svelte impose un compilateur dans le pipeline de build. Mais c'est aussi le cas de TypeScript, donc on en a déjà l'habitude.

## Le cas MiraMD

MiraMD a deux moteurs de rendu qui cohabitent.

- **L'interface globale** (onglets, barre de titre, status bar, menus, dialogs) est en **Svelte**. Pas de Virtual DOM. Quand un store change, Svelte met à jour les éléments concernés directement.
- **L'éditeur central** est [Muya](../01-decouverte/glossaire.md#muya), qui utilise **Snabbdom** (un VDOM minimaliste) en interne. Quand tu tapes une lettre, Muya reconstruit son arbre virtuel pour le contenu courant, le compare au précédent, et applique le diff.

Les deux mondes ne se mélangent pas. Svelte ne sait rien du VDOM de Muya, et Muya ne sait rien des stores Svelte. Ils communiquent via le service `MuyaService`, qui sert de passerelle (voir [`04-architecture/integration-muya.md`](../04-architecture/integration-muya.md)).

Pourquoi cette dualité ? Parce que les deux contextes ont des contraintes différentes. L'interface globale change peu (un onglet ajouté, un thème modifié) — Svelte excelle dans ce cas. L'éditeur central, au contraire, change à chaque frappe, sur des arbres potentiellement complexes — un VDOM rend le diff plus simple à maintenir dans ce contexte. Chaque outil au bon endroit.

## Pour aller plus loin

- Pour comprendre la réactivité Svelte sans VDOM, va voir [`02-fondamentaux/reactivite.md`](reactivite.md).
- Pour le détail de l'intégration Muya/Snabbdom dans MiraMD, va voir [`04-architecture/integration-muya.md`](../04-architecture/integration-muya.md).
- Pour le choix de Svelte plutôt que React/Vue (qui auraient apporté un VDOM), va voir [`03-choix-techniques/02-svelte-vs-vue-react.md`](../03-choix-techniques/02-svelte-vs-vue-react.md).
