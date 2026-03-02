# Application desktop

Une [application desktop](../01-decouverte/glossaire.md#application-desktop) est un logiciel qu'on installe sur son ordinateur et qu'on lance comme on lancerait Word, VLC ou Firefox. Elle vit dans le système, pas dans un onglet de navigateur ni sur un téléphone. MiraMD en est une.

## Trois familles d'applications

Aujourd'hui, un même service peut exister sous trois formes différentes. Prenons trois exemples connus :

- **Web** : Gmail. Tu ouvres `gmail.com` dans Chrome ou Firefox, et l'interface est servie par les serveurs de Google. Rien n'est installé sur ta machine. Si tu n'as pas de réseau, tu n'as plus rien.
- **Mobile** : WhatsApp. Tu installes l'application depuis le store de ton téléphone. Elle a accès aux contacts, à l'appareil photo, aux notifications. Elle s'adapte à un écran tactile.
- **Desktop** : VLC. Tu télécharges un fichier `.exe`, `.dmg` ou `.deb`, tu l'installes, et le logiciel s'intègre à ton système. Il peut lire un fichier vidéo posé sur ton bureau, sans demander la permission au cloud.

Les trois familles partagent souvent les mêmes fonctions, mais le contexte d'exécution change tout. Web = navigateur d'autrui, mobile = téléphone, desktop = ton ordinateur à toi.

## Pourquoi un éditeur de texte est typiquement desktop

Un éditeur de notes ou de Markdown manipule des fichiers `.md` sur ton disque. Quatre raisons rendent le format desktop naturel :

### Accès aux fichiers natif

Une application desktop peut ouvrir, lire, écrire un fichier comme n'importe quel programme. Pas de boîte d'upload, pas de dialog cloud. Tu double-cliques sur `notes.md` et l'éditeur s'ouvre dessus. Une application web ne peut pas faire ça librement : le navigateur l'isole derrière une [sandbox](../01-decouverte/glossaire.md#sandbox) qui interdit l'accès direct au disque.

### Performance

Lire un fichier local est instantané. Le rendu visuel exploite directement le processeur graphique. Pas de transit réseau, pas de couche de chiffrement HTTPS à traverser. Pour une application qu'on utilise des heures par jour, la fluidité compte.

### Hors-ligne par défaut

Tu peux écrire dans le train, dans un avion, dans une cave. Une application web a besoin du serveur — ou alors elle joue à émuler le hors-ligne avec des compromis.

### Pas de latence réseau

Chaque frappe doit être affichée en quelques millisecondes pour ne pas casser le flow de l'écriture. Avec une application desktop, tout reste en mémoire locale. Avec une application web, certaines opérations dépendent du serveur — et même l'échange local devient plus complexe.

### Confidentialité

Tes notes ne quittent pas ta machine. Pas de compte à créer, pas de serveur tiers à qui tu confies tes idées. Pour des notes professionnelles, des journaux personnels, ou simplement par principe, beaucoup d'utilisateurs préfèrent garder leurs documents chez eux. C'est l'un des arguments les plus forts pour MiraMD : strictement local, aucune donnée envoyée à l'extérieur.

## Comment fait-on une app desktop avec des techno web

Historiquement, faire du desktop voulait dire écrire en C++, en Java, ou avec des outils natifs comme WinForms ou Cocoa. Aujourd'hui, deux frameworks dominent l'approche "techno web pour desktop" :

- **[Electron](../01-decouverte/glossaire.md#electron)** embarque un navigateur Chromium complet et un runtime Node.js dans chaque application. C'est ce qu'utilisent VS Code, Slack, Discord, et c'est ce qu'utilisait MarkText. Avantage : très flexible. Inconvénient : chaque application pèse 150 à 250 MB.
- **[Tauri](../01-decouverte/glossaire.md#tauri)** utilise la [WebView](../01-decouverte/glossaire.md#webview) déjà installée dans le système d'exploitation et y associe un binaire [Rust](../01-decouverte/glossaire.md#rust). Avantage : une application Tauri pèse souvent moins de 10 MB. Inconvénient : la WebView varie selon l'OS, ce qui demande un peu plus de travail pour assurer une cohérence cross-plateforme.

MiraMD a choisi Tauri. Le détail de ce choix vit dans [`03-choix-techniques/01-tauri-vs-electron.md`](../03-choix-techniques/01-tauri-vs-electron.md).

## Pour aller plus loin

- Pour comprendre comment Tauri concrétise tout ça côté MiraMD, va voir [`02-fondamentaux/runtime.md`](runtime.md).
- Pour voir l'architecture complète de l'application, va voir [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md).
