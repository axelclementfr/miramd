# Glossaire

Ce glossaire rassemble les termes techniques utilisés dans la documentation de MiraMD. Chaque terme y est défini en deux ou trois phrases, avec un exemple ou une analogie quand c'est utile. Les autres pages de la doc renvoient ici via des liens cliquables (par exemple `[framework](glossaire.md#framework)`).

L'ordre est alphabétique. Si un terme manque, c'est probablement qu'il n'est pas (encore) utilisé dans la doc — n'hésite pas à le signaler.

---

### ADR

*Architecture Decision Record*. Un court document qui consigne **une décision technique** prise à un moment donné : le contexte, les options envisagées, le choix final, et les conséquences. C'est l'équivalent d'une note d'ingénieur. Les ADRs de MiraMD sont dans [`docs/03-choix-techniques/`](../03-choix-techniques/).

### API

*Application Programming Interface*. L'ensemble des "boutons" qu'un programme expose pour qu'un autre programme l'utilise. Quand on dit "l'API de Muya offre `getMarkdown()`", ça signifie qu'on peut appeler cette fonction depuis l'extérieur de Muya pour obtenir le contenu courant.

### Application desktop

Un logiciel qu'on installe et qu'on lance sur son ordinateur (par opposition à un site web ouvert dans un navigateur, ou une application mobile). Word, VLC, Firefox, MiraMD sont des applications desktop. Voir aussi [`02-fondamentaux/application-desktop.md`](../02-fondamentaux/application-desktop.md).

### Backend

La partie d'une application qui s'occupe **du système** (lire/écrire des fichiers, parler au réseau, faire des calculs lourds). Dans MiraMD, le backend est écrit en [Rust](#rust) et tourne grâce à [Tauri](#tauri). Opposé : [frontend](#frontend).

### Binaire (exécutable)

Le fichier qu'un ordinateur peut exécuter directement, contenant des instructions en langage machine. Quand tu télécharges MiraMD sous forme `.deb` ou `.exe`, tu installes en réalité un binaire compilé pour ton système. Le binaire de MiraMD pèse environ 5 MB.

### Bundler

Un outil qui prend tout le code source d'un projet (TypeScript, Svelte, CSS, images...) et le rassemble en quelques gros fichiers optimisés pour la production. MiraMD utilise [Vite](#vite). Sans bundler, le navigateur devrait charger des centaines de petits fichiers à chaque démarrage.

### Cargo

Le gestionnaire de dépendances et de build du langage [Rust](#rust). C'est l'équivalent de [npm](#npm) pour JavaScript. `cargo build` compile le projet, `cargo test` lance les tests, `cargo audit` vérifie les failles de sécurité.

### Capability (Tauri)

Une autorisation explicite déclarée dans `src-tauri/capabilities/`. Elle décrit ce que la WebView a le droit de faire (afficher des dialogs, ouvrir des liens, etc.). Sans la capability correspondante, l'appel échoue. C'est un pilier du modèle de sécurité de [Tauri](#tauri).

### Compilation

L'opération de **traduire un code source** (lisible par un humain) **en code machine** (lisible par le processeur). Le code compilé s'exécute directement, sans avoir besoin d'un interpréteur. [Rust](#rust) est compilé. Voir aussi [`02-fondamentaux/compilation-vs-interpretation.md`](../02-fondamentaux/compilation-vs-interpretation.md).

### comrak

Une bibliothèque écrite en [Rust](#rust) qui sait lire du [Markdown](#markdown) et le transformer en HTML. MiraMD l'utilise côté backend pour le rendu et l'analyse des documents. Avantage : très rapide et sûre (configurée pour ne pas exécuter de HTML brut).

### CSP

*Content Security Policy*. Une règle déclarée dans `tauri.conf.json` qui dit au navigateur **ce qui a le droit de s'exécuter dans la page**. Par exemple, "seuls les scripts du même domaine sont autorisés". C'est une protection contre les attaques par injection. La CSP de MiraMD interdit la majorité des sources externes.

### Debounce

Technique pour ne réagir à un événement **qu'après une pause**. Exemple : on n'enregistre pas le document à chaque frappe, mais 100 ms après la dernière frappe. Ça évite de saturer la machine. MiraMD debounce le content update (100 ms), les stats (300 ms), la TOC (300 ms), la sauvegarde (200 ms).

### DOM

*Document Object Model*. La représentation en mémoire d'une page web : une arborescence d'éléments (`<div>`, `<p>`, `<button>`...) que le navigateur dessine et que le code JavaScript peut manipuler.

### DOMPurify

Une bibliothèque JavaScript qui **nettoie du HTML potentiellement dangereux** avant de l'insérer dans le DOM. Elle retire les scripts, les attributs malveillants, etc. MiraMD l'utilise (côté Muya) pour sécuriser le contenu collé ou rendu.

### Electron

Un framework qui permet de construire des applications desktop avec des techno web (HTML, CSS, JS). Il embarque Chromium et Node.js. C'est ce que MarkText utilisait. Conséquence : très flexible mais lourd (~200 MB). MiraMD a choisi [Tauri](#tauri) à la place. Voir [`03-choix-techniques/01-tauri-vs-electron.md`](../03-choix-techniques/01-tauri-vs-electron.md).

### Framework

Une **structure logicielle** qui impose une façon d'organiser son code et fournit des outils pour les tâches courantes. Différent d'une bibliothèque : avec une bibliothèque, c'est ton code qui appelle la bibliothèque ; avec un framework, c'est le framework qui appelle ton code. [Svelte](#svelte) et [Tauri](#tauri) sont des frameworks. Voir [`02-fondamentaux/framework.md`](../02-fondamentaux/framework.md).

### Frontend

La partie d'une application qui s'occupe **de l'interface visible** : ce que l'utilisateur voit et avec quoi il interagit. Dans MiraMD, le frontend est écrit en [Svelte](#svelte) et s'exécute dans une [WebView](#webview). Opposé : [backend](#backend).

### Hook (React/Svelte/etc.)

Une fonction qu'on **branche à un moment du cycle de vie** d'un composant. Par exemple `onMount(() => ...)` est un hook qui s'exécute quand le composant apparaît à l'écran. MiraMD utilise les hooks Svelte 5.

### Interprétation

L'opération d'**exécuter un code source à la volée**, ligne par ligne, sans le compiler au préalable. JavaScript est interprété (par un moteur dans le navigateur). Plus flexible que la [compilation](#compilation), mais en général plus lent et plus exposé aux erreurs au runtime. Voir [`02-fondamentaux/compilation-vs-interpretation.md`](../02-fondamentaux/compilation-vs-interpretation.md).

### IPC

*Inter-Process Communication*. La communication entre deux **processus** différents. Dans MiraMD, le frontend (WebView) et le backend (Rust) sont deux processus. Quand le frontend appelle `invoke('read_file', { path })`, c'est un appel IPC qui traverse cette frontière. Voir [`02-fondamentaux/ipc.md`](../02-fondamentaux/ipc.md).

### Linter

Un outil qui analyse le code pour repérer des erreurs probables, des incohérences de style, des constructions douteuses. MiraMD utilise [Biome](#biome) qui combine linter et formateur. Lancé par `npm run lint`.

### Biome

Un outil tout-en-un (linter + formateur) écrit en Rust pour le code JavaScript/TypeScript. Plus rapide qu'ESLint + Prettier combinés. Configuré dans `biome.json`. MiraMD l'utilise via les scripts `lint`, `lint:fix`, `format`.

### Markdown

Un format texte simple où l'on indique la mise en forme avec quelques caractères (`# Titre`, `**gras**`, `- liste`). Inventé en 2004, devenu le standard de fait pour la documentation, les README, et les éditeurs de notes. MiraMD est conçu pour éditer du Markdown. Voir [`01-decouverte/quest-ce-que-le-markdown.md`](quest-ce-que-le-markdown.md).

### Muya

Le **moteur d'édition WYSIWYG** créé par les auteurs de MarkText. Il transforme la frappe Markdown en rendu visuel en temps réel (taper `# foo` → ça devient un titre). MiraMD réutilise Muya tel quel (vendored dans `src/lib/muya/`) plutôt que d'en réécrire un. Voir [`02-fondamentaux/wysiwyg.md`](../02-fondamentaux/wysiwyg.md) et [`03-choix-techniques/04-muya-conserve.md`](../03-choix-techniques/04-muya-conserve.md).

### Node.js

Un environnement qui permet d'exécuter du JavaScript en dehors d'un navigateur (sur un serveur, en ligne de commande). Il est nécessaire pour développer MiraMD (`npm run tauri dev`) mais **pas** pour l'utiliser : le binaire packagé n'embarque pas Node.

### npm

Le gestionnaire de paquets de [Node.js](#nodejs). Permet d'installer les bibliothèques JavaScript dont un projet a besoin (`npm install`) et de lancer ses scripts (`npm run dev`).

### Parser

Un programme qui **analyse un texte structuré et le transforme en arborescence exploitable**. Le parser Markdown lit ton document et en produit un arbre syntaxique (titre → paragraphe → liste...). [comrak](#comrak) est le parser Markdown utilisé par MiraMD côté backend.

### Process

Une instance d'un programme qui s'exécute, avec sa propre mémoire et son propre espace de noms. Le système d'exploitation isole les processus les uns des autres. MiraMD lance plusieurs processus : un pour le backend Rust, un pour la WebView qui affiche l'interface.

### Réactivité

Le mécanisme par lequel **un changement de valeur déclenche automatiquement la mise à jour de tout ce qui en dépend**. Si tu changes le titre d'un document, l'onglet, la barre de titre, la TOC se mettent à jour automatiquement. C'est le cœur du fonctionnement de [Svelte](#svelte). Voir [`02-fondamentaux/reactivite.md`](../02-fondamentaux/reactivite.md).

### Runtime

L'**environnement qui exécute** un programme : ce qui charge le code, gère la mémoire, fournit les fonctions de base. Le runtime de Node.js est V8 + libuv. Le runtime d'une app [Electron](#electron) est Chromium + Node. Le runtime d'une app [Tauri](#tauri) est la WebView de l'OS + le binaire Rust. Voir [`02-fondamentaux/runtime.md`](../02-fondamentaux/runtime.md).

### Rust

Un langage de programmation **compilé** moderne, conçu pour la sûreté mémoire et la performance. Pas de garbage collector, mais un système de "ownership" qui empêche au moment de la compilation tout un tas de bugs courants. MiraMD utilise Rust pour son backend.

### Sandbox

Un environnement d'exécution **restreint** : un programme dans une sandbox ne peut pas accéder à ce qui est en dehors (sauf permissions explicites). La WebView de [Tauri](#tauri) est en sandbox : elle ne peut pas lire les fichiers de l'utilisateur sans passer par des commandes Rust contrôlées.

### Serde

La bibliothèque [Rust](#rust) standard pour **sérialiser/désérialiser** des données (JSON, YAML, MessagePack...). Quand le frontend MiraMD envoie un objet via [IPC](#ipc), Serde s'occupe de le convertir en JSON puis de le re-construire côté Rust.

### Singleton

Un **objet unique** dans tout le programme : peu importe combien de fois on l'instancie, c'est toujours la même instance. `MuyaService` dans MiraMD est un singleton — il n'y a qu'une seule passerelle vers Muya, partagée par tous les composants.

### Snabbdom

Une petite bibliothèque qui implémente un [Virtual DOM](#virtual-dom). Utilisée à l'intérieur de [Muya](#muya) pour mettre à jour le rendu de l'éditeur efficacement. Note : [Svelte](#svelte) n'utilise PAS de virtual DOM ; le seul VDOM dans MiraMD est dans Muya.

### Store (Svelte)

Un **conteneur de valeur réactive** dans Svelte. Quand le store change, tous les composants qui en dépendent se mettent à jour automatiquement. MiraMD a 4 stores principaux : `editor`, `preferences`, `toast`, `muyaInstance`.

### Svelte

Un framework JavaScript pour construire des interfaces. Particularité : il **compile** ton code Svelte en JavaScript natif minimal au moment du build. Conséquence : pas de runtime alourdi, des bundles très petits. MiraMD utilise Svelte 5. Voir [`03-choix-techniques/02-svelte-vs-vue-react.md`](../03-choix-techniques/02-svelte-vs-vue-react.md).

### Tauri

Un framework pour construire des applications desktop en utilisant la [WebView](#webview) du système d'exploitation pour le rendu, et un binaire [Rust](#rust) pour le système. Alternative légère à [Electron](#electron). Tauri 2 est la version actuelle. MiraMD est construit avec Tauri 2.

### Throttle

Cousin du [debounce](#debounce). Au lieu d'attendre une pause, throttle **limite la fréquence** : "exécute au maximum une fois toutes les 50 ms". Utile pour les événements continus comme le scroll. MiraMD throttle le typewriter scroller à 50 ms.

### TypeScript

JavaScript + un système de types. Ton code TypeScript décrit la forme attendue des données (`function add(x: number, y: number): number`), et le compilateur attrape les erreurs avant l'exécution. Le frontend de MiraMD est écrit en TypeScript.

### Vite

Le [bundler](#bundler) utilisé par MiraMD côté frontend. Très rapide en mode dev grâce au chargement à la demande, et produit un bundle optimisé en mode build. Configuré dans `vite.config.js`.

### Virtual DOM

Une représentation **en mémoire** du DOM, sur laquelle on travaille avant d'appliquer les changements au vrai DOM (qui est lent à manipuler). On dit aussi VDOM. [React](https://react.dev), [Vue](https://vuejs.org), [Snabbdom](#snabbdom) en utilisent un. [Svelte](#svelte) **n'en utilise pas** : il compile vers du DOM natif directement. Voir [`02-fondamentaux/virtual-dom.md`](../02-fondamentaux/virtual-dom.md).

### WebKitGTK

L'implémentation de WebKit (le moteur de rendu de Safari) pour Linux/GTK. C'est ce que [Tauri](#tauri) utilise comme [WebView](#webview) sur Linux. Particularité importante : il **ne supporte pas certains comportements natifs du contenteditable** (notamment Ctrl+Z), ce qui force MiraMD à intercepter ces raccourcis manuellement dans `MuyaPane.svelte`.

### WebView

Un composant qui affiche des pages web **à l'intérieur d'une application** (autre qu'un navigateur). Sur macOS, c'est WKWebView. Sur Linux, [WebKitGTK](#webkitgtk). Sur Windows, WebView2 (basé sur Edge). [Tauri](#tauri) utilise la WebView de l'OS au lieu d'embarquer Chromium comme [Electron](#electron) — c'est ce qui rend MiraMD léger.

### WYSIWYG

*What You See Is What You Get*. Une approche d'édition où **le rendu final est ce que tu vois pendant que tu tapes**. Quand tu tapes `# Titre` dans MiraMD, tu vois directement le texte mis en forme comme un titre, pas la syntaxe brute. Opposé : éditeur "source" classique. Voir [`02-fondamentaux/wysiwyg.md`](../02-fondamentaux/wysiwyg.md).
