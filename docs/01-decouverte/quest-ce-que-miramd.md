# Qu'est-ce que MiraMD ?

MiraMD est un éditeur [Markdown](glossaire.md#markdown) [desktop](glossaire.md#application-desktop), léger et conçu avec un souci constant de la sécurité. Tu y rédiges du texte enrichi (titres, listes, gras, liens, tableaux, code) qui reste, dans le fichier final, du simple texte lisible partout.

## Pour qui

MiraMD s'adresse à toutes les personnes qui écrivent souvent et veulent un outil **rapide, sobre, et qui ne casse pas** :

- **Preneurs de notes** — un fichier `.md` par sujet, parfois rangés dans un dossier git pour la sauvegarde.
- **Rédacteurs de documentation technique** — README, guides, runbooks, rapports.
- **Auteurs de textes longs** — articles, essais, mémoires, brouillons. Le mode focus et le mode machine à écrire sont conçus pour ça.
- **Développeurs** — qui passent leur journée dans des `.md` et apprécient un éditeur dédié plutôt qu'un onglet de navigateur.

Aucune connaissance de la programmation n'est nécessaire pour utiliser MiraMD. La syntaxe Markdown est apprise en quelques minutes, et l'éditeur la rend pour toi pendant que tu tapes (mode [WYSIWYG](glossaire.md#wysiwyg)).

## Pourquoi pas un autre éditeur ?

Il existe beaucoup d'éditeurs Markdown. MiraMD se distingue sur trois points :

### Léger

| | MarkText (l'origine) | MiraMD |
|---|---|---|
| Taille du paquet `.deb` | environ 90 Mo | **5 Mo** |
| Mémoire vive au repos | environ 300 Mo | **environ 30 Mo** |
| Démarrage à froid | environ 3 secondes | **moins d'une seconde** |

La différence vient du choix de [Tauri](glossaire.md#tauri) à la place d'[Electron](glossaire.md#electron). Tauri utilise la [WebView](glossaire.md#webview) déjà installée sur ton système d'exploitation au lieu d'embarquer un navigateur entier. Voir l'[ADR sur Tauri vs Electron](../03-choix-techniques/01-tauri-vs-electron.md).

### Sécurisé

MiraMD applique le modèle de sécurité par défaut de Tauri :

- **Sandbox** — l'interface (frontend) ne peut pas accéder directement au disque, au réseau, ni au système. Toute opération sensible passe par des commandes [Rust](glossaire.md#rust) explicitement autorisées.
- **CSP** — une [Content Security Policy](glossaire.md#csp) restrictive bloque le chargement de scripts ou de styles externes.
- **Validations** — les chemins de fichiers sont canonicalisés et contrôlés côté Rust (protection contre les attaques *path traversal*).

À titre de comparaison, MarkText fonctionnait avec `contextIsolation` désactivé et `nodeIntegration` activé : le moindre script malveillant collé dans un document avait un accès complet à l'ordinateur. MiraMD ferme cette porte. Voir [`../06-references/audit.md`](../06-references/audit.md) pour le détail.

### Performant

Le rendu et l'analyse du Markdown sont faits par [comrak](glossaire.md#comrak), une bibliothèque écrite en [Rust](glossaire.md#rust) compilée en code machine natif. Sur un document de plusieurs milliers de lignes, c'est de l'ordre de 10 à 100 fois plus rapide qu'un parser JavaScript équivalent.

Le **mode résident** garde MiraMD prêt en tâche de fond : tu fermes la fenêtre, mais le processus reste dans la zone de notification. Rouvrir une fenêtre est alors instantané.

## Statut actuel

MiraMD est en **alpha**, en développement actif. Les fondations (édition, ouverture, sauvegarde, onglets, préférences) sont stables. Certaines fonctionnalités sont absentes ou en cours de finalisation.

La liste détaillée des limites et bugs connus est tenue à jour dans [`../06-references/problemes-connus.md`](../06-references/problemes-connus.md).

## Origine

MiraMD est une **réécriture complète** de [MarkText](https://github.com/marktext/marktext), motivée par trois constats :

1. **[Electron](glossaire.md#electron) 18 est en fin de vie depuis 2022** — plus de mises à jour de sécurité officielles côté Chromium intégré.
2. **Vue 2 est en mode maintenance** — le framework historique du frontend MarkText n'est plus activement développé.
3. **Le modèle de sécurité de MarkText est daté** — context isolation désactivée, nodeIntegration activée, pas de CSP. Le résultat est qu'une simple inclusion HTML malveillante peut compromettre la machine.

Le projet réutilise tel quel le moteur d'édition WYSIWYG de MarkText, [Muya](glossaire.md#muya), parce qu'il est mature et qu'aucune alternative open-source n'offre la même expérience d'édition. Voir l'[ADR sur la conservation de Muya](../03-choix-techniques/04-muya-conserve.md).

## Le nom

*Mira* vient du latin et signifie "merveilleux" ou "étonnant". Combiné à *MD* pour [Markdown](glossaire.md#markdown), ça donne **MiraMD** : un éditeur Markdown qui se veut agréable à utiliser.

## Pour aller plus loin

- [`quest-ce-que-le-markdown.md`](quest-ce-que-le-markdown.md) — si la notion de Markdown est nouvelle pour toi.
- [`installation.md`](installation.md) — pour installer MiraMD sur ta machine.
- [`premiere-utilisation.md`](premiere-utilisation.md) — un tour rapide de l'application.
- [`../04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — comment l'application fonctionne en interne.
