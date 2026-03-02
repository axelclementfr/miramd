# Framework

Un [framework](../01-decouverte/glossaire.md#framework) est une **structure logicielle** : il impose une façon d'organiser ton code et fournit, en échange, des outils pour les tâches courantes. Tu adoptes ses règles, tu gagnes son confort.

## Bibliothèque ou framework

Le mot "framework" est souvent confondu avec "bibliothèque" (ou *library*). La distinction est pourtant nette.

### L'analogie de la cuisine

Imagine que tu veuilles préparer un dîner.

- **Avec une bibliothèque**, tu achètes des ingrédients : farine, œufs, beurre. Tu cuisines comme tu veux, dans la cuisine de ton choix, avec le matériel que tu veux. Tu décides à quel moment tu utilises chaque ingrédient.
- **Avec un framework**, tu loues une cuisine industrielle déjà équipée. La cuisine impose ses postes, son rythme, ses règles d'hygiène. Tu poses tes ingrédients où on te dit, tu démarres quand le four sonne. En échange, tout le matériel lourd est déjà là.

Une bibliothèque, c'est un sac d'outils. Un framework, c'est une chaîne de production.

### L'inversion de contrôle

Cette différence porte un nom technique : l'**inversion de contrôle**. Avec une bibliothèque, c'est ton code qui appelle la bibliothèque (`bcrypt.hash(password)`). Avec un framework, c'est le framework qui appelle ton code, à des moments qu'il a choisis.

Quand tu écris un composant Svelte, tu ne décides pas quand il s'affiche. C'est [Svelte](../01-decouverte/glossaire.md#svelte) qui décide : il appelle la fonction `onMount` à un moment précis du cycle de vie. Ton code remplit des cases prévues par le framework.

C'est ce que les développeurs résument par la formule : "*Don't call us, we'll call you*".

## Trois exemples présents dans MiraMD

MiraMD utilise plusieurs frameworks empilés. Chacun s'occupe d'un domaine distinct :

- **Svelte** est le framework d'**interface**. Il décide quand chaque composant apparaît, quand il se met à jour, comment il réagit aux changements de données. Tu écris des composants, il s'occupe du reste.
- **[Tauri](../01-decouverte/glossaire.md#tauri)** est le framework d'**intégration desktop**. Il fournit la fenêtre, la WebView, les commandes [IPC](../01-decouverte/glossaire.md#ipc), le packaging, les mises à jour. Tu déclares ce dont tu as besoin, il assemble l'application autour.
- **[Vite](../01-decouverte/glossaire.md#vite)** est le framework de **build**. Il prend tes fichiers source (TypeScript, Svelte, CSS) et les transforme en bundle prêt à exécuter. Pendant le développement, il sert le code à la volée avec rechargement automatique.

À côté de ces trois frameworks, MiraMD utilise aussi des bibliothèques classiques (par exemple [Snabbdom](../01-decouverte/glossaire.md#snabbdom) à l'intérieur de [Muya](../01-decouverte/glossaire.md#muya)). On les appelle quand on en a besoin, sans qu'elles imposent de structure globale.

## Pourquoi en utiliser au lieu de tout faire à la main

Un framework n'est pas obligatoire. On peut écrire une application desktop sans Tauri, une interface sans Svelte. Trois raisons font qu'on les choisit quand même :

### Productivité

Le framework a déjà résolu les problèmes courants : gestion d'état, rendu, événements clavier, build. Tu réutilises des solutions éprouvées au lieu de les réinventer pour la centième fois. Quelques semaines économisées dès le départ.

### Sécurité héritée

Un framework comme Tauri a été audité, les failles connues ont été corrigées. En l'utilisant, MiraMD bénéficie de ces garanties sans avoir à les construire. Tauri impose par exemple une [CSP](../01-decouverte/glossaire.md#csp) et un système de [capabilities](../01-decouverte/glossaire.md#capability-tauri) qui rendent certaines attaques très difficiles.

### Communauté

Quand tu utilises un framework populaire, tu trouves des réponses à tes questions, des bibliothèques compatibles, des exemples de code. Si tu écris ton propre framework, tu es seul.

## Le revers

Un framework impose ses choix. Si demain Svelte change radicalement, MiraMD devra suivre — ou rester sur une version figée. Si Tauri introduit un bug, on attend le correctif amont. C'est le prix de la productivité. On choisit donc des frameworks **maintenus, ouverts, et raisonnables**.

Autre revers : la **courbe d'apprentissage**. Adopter Svelte demande de comprendre sa philosophie de réactivité, ses conventions de fichiers, son langage de template. Ce sont quelques jours de formation pour un nouveau contributeur, mais c'est compensé par les semaines économisées sur le code de plomberie qu'on n'a pas à écrire.

## Pour aller plus loin

- Le détail des choix de frameworks de MiraMD vit dans [`03-choix-techniques/`](../03-choix-techniques/).
- Pour voir comment ces frameworks s'imbriquent en pratique, va voir [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md).
