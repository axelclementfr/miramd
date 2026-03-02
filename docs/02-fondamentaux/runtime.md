# Runtime

Le [runtime](../01-decouverte/glossaire.md#runtime) est l'**environnement qui exécute** un programme. C'est lui qui charge le code, gère la mémoire, fournit les fonctions de base (afficher du texte, ouvrir un fichier, appeler le réseau). Sans runtime, du code n'est qu'un fichier inerte.

## La métaphore du four

Imagine que tu es traiteur et que tu dois servir un plat. Tu peux faire ça de deux façons :

- **Tu amènes ton propre four** dans la salle de réception. C'est lourd, ça prend de la place, ça consomme — mais tu maîtrises tout. Tu connais sa température, ses caprices. C'est le modèle [Electron](../01-decouverte/glossaire.md#electron).
- **Tu utilises le four de la cuisine d'accueil**. Tu arrives léger, tu cuisines avec ce qui est sur place. Mais le four varie : à Lyon il chauffe vite, à Marseille il a un mode vapeur, à Lille il manque un thermostat. C'est le modèle [Tauri](../01-decouverte/glossaire.md#tauri).

Les deux approches livrent un plat. Mais elles n'ont pas le même poids ni les mêmes contraintes.

## Electron : le four embarqué

Electron embarque deux runtimes complets dans chaque application :

- **Chromium** : le moteur de rendu de Chrome, qui affiche l'interface en HTML/CSS et exécute le JavaScript.
- **[Node.js](../01-decouverte/glossaire.md#nodejs)** : un runtime JavaScript serveur, qui donne accès au système de fichiers, au réseau, aux processus.

Une application Electron pèse en général 150 à 250 MB. Elle démarre en 2 à 5 secondes. Elle consomme 200 à 500 MB de RAM, même pour afficher un éditeur de texte simple.

Avantage : le rendu est **identique** sur Windows, macOS et Linux. Tu écris une fois, ça se comporte pareil partout. C'est pourquoi VS Code, Slack, Discord et MarkText ont tous fait ce choix.

## Tauri : le four de l'OS

Tauri n'embarque pas de navigateur. Il utilise la [WebView](../01-decouverte/glossaire.md#webview) déjà installée dans le système d'exploitation :

- Sur **Linux**, c'est [WebKitGTK](../01-decouverte/glossaire.md#webkitgtk) (WebKit, le moteur de Safari, adapté à GTK).
- Sur **macOS**, c'est WKWebView (WebKit natif).
- Sur **Windows**, c'est WebView2 (basé sur Edge, donc Chromium).

Pour la partie système, Tauri utilise un binaire [Rust](../01-decouverte/glossaire.md#rust) compilé. Pas de Node.js embarqué.

Une application Tauri pèse en général 5 à 15 MB. Elle démarre en moins de 100 millisecondes. Elle consomme 30 à 80 MB de RAM.

C'est ce qui explique pourquoi MiraMD fait environ 5 MB et démarre instantanément, là où MarkText (Electron) faisait 200 MB et mettait 3 secondes à s'ouvrir.

## Le revers : la fragmentation des WebView

Utiliser le four de l'hôte coûte une chose : les fours sont différents.

- WebKitGTK sur Linux a quelques manques bien identifiés. Par exemple, il **ne supporte pas Ctrl+Z natif** dans un champ `contenteditable`. MiraMD doit donc intercepter ce raccourci à la main et appeler son propre historique [Muya](../01-decouverte/glossaire.md#muya).
- WKWebView sur macOS supporte la plupart des standards modernes mais a parfois des bugs spécifiques.
- WebView2 sur Windows est très proche de Chrome, donc rarement problématique.

Conséquence : tester MiraMD sur les trois OS est important. Une fonctionnalité qui marche sur macOS peut casser sur Linux. C'est le prix de la légèreté — et c'est documenté en détail dans [`04-architecture/securite.md`](../04-architecture/securite.md) et [`05-fonctionnalites/`](../05-fonctionnalites/) pour les contournements concrets.

## Le cas particulier de Node.js

[Node.js](../01-decouverte/glossaire.md#nodejs) mérite une mention. C'est lui aussi un runtime : il exécute du JavaScript en dehors d'un navigateur, sur un serveur ou en ligne de commande. C'est ce qui permet à `npm run dev` de fonctionner.

Tauri **n'embarque pas Node.js** dans le binaire final. On en a besoin uniquement pendant le développement, pour faire tourner [Vite](../01-decouverte/glossaire.md#vite) et compiler le frontend. Quand un utilisateur télécharge MiraMD, il n'a pas besoin de Node.js installé sur sa machine. Electron, à l'inverse, embarque Node.js dans chaque application — c'est l'une des raisons de son poids.

## Récapitulatif

| Critère | Electron (MarkText) | Tauri (MiraMD) |
|---|---|---|
| Poids du binaire | ~200 MB | ~5 MB |
| Démarrage à froid | 2 à 5 secondes | <100 ms |
| RAM au repos | 200 à 500 MB | 30 à 80 MB |
| Cohérence cross-OS | Très bonne (Chromium partout) | Moyenne (WebView varie) |
| Contrôle bas niveau | Node.js complet, beaucoup d'API | Rust + commandes IPC explicites |

## Pourquoi ce choix compte pour les utilisateurs

Le poids et la rapidité de démarrage ne sont pas que des chiffres techniques. Ils changent l'expérience d'utilisation au quotidien. Ouvrir une note rapide dans MiraMD est aussi instantané qu'ouvrir un fichier dans le Bloc-notes — alors que MarkText demandait de patienter quelques secondes. Sur un vieux portable, sur un Raspberry Pi, sur un netbook, la différence n'est plus de l'ordre du confort : c'est ce qui rend l'application utilisable ou pas.

## Pour aller plus loin

- Le détail du choix Tauri vs Electron est dans [`03-choix-techniques/01-tauri-vs-electron.md`](../03-choix-techniques/01-tauri-vs-electron.md).
- Pour comprendre comment frontend et backend communiquent dans une app Tauri, va voir [`02-fondamentaux/ipc.md`](ipc.md).
- Pour voir comment ces deux runtimes s'articulent dans MiraMD, va voir [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md).
