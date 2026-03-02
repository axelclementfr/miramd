# Compilation vs interprétation

Tout programme est écrit dans un langage que l'humain peut lire. Avant de tourner sur la machine, il faut traduire ce code en quelque chose que le processeur comprend. Il existe deux grandes façons de faire cette traduction : la [compilation](../01-decouverte/glossaire.md#compilation) et l'[interprétation](../01-decouverte/glossaire.md#interpretation).

## Deux approches, une même finalité

### Compilation : traduire avant d'exécuter

Un compilateur prend tout le code source, le lit en entier, vérifie sa cohérence, et produit un fichier exécutable. Ce fichier — un [binaire](../01-decouverte/glossaire.md#binaire-executable) — contient des instructions directement compréhensibles par le processeur. Une fois compilé, le programme tourne sans avoir besoin du compilateur ni du code source.

Langages compilés courants : [Rust](../01-decouverte/glossaire.md#rust), C, C++, Go.

### Interprétation : exécuter à la volée

Un interpréteur lit le code source ligne par ligne, et exécute chaque instruction au fur et à mesure. Pas de phase de traduction préalable. Le code source doit être présent au moment de l'exécution, et l'interpréteur aussi.

Langages interprétés courants : JavaScript (interprété par le moteur du navigateur ou par [Node.js](../01-decouverte/glossaire.md#nodejs)), Python, Ruby.

### L'analogie du dîner

- **Compilation** : tu prépares ton dîner en avance, le matin. Tu épluches, tu coupes, tu cuis. Le soir, tu sors le plat du frigo, tu réchauffes, c'est prêt en deux minutes. Tu as travaillé une fois, tu manges rapidement.
- **Interprétation** : tu cuisines à la commande. À chaque convive qui arrive, tu épluches, tu coupes, tu cuis. C'est très flexible — chacun peut demander un plat différent — mais c'est plus lent à servir.

## Conséquences pratiques

Le choix compilation/interprétation a des effets concrets sur le programme et sur la façon de le distribuer.

### Performance

Le code compilé est en général plus rapide. Le processeur exécute directement les instructions natives, sans passer par un interpréteur qui les traduit à la volée. C'est pourquoi les outils où chaque milliseconde compte (moteurs de jeu, systèmes embarqués, navigateurs eux-mêmes) sont souvent compilés.

### Distribution

Avec un langage compilé, on distribue **un binaire**. L'utilisateur télécharge un fichier, le lance, ça marche. Il n'a pas besoin d'installer le compilateur, ni le code source. Avec un langage interprété, il faut soit que l'interpréteur soit déjà présent sur la machine (Python sur Linux, par exemple), soit qu'il soit fourni avec le programme.

### Détection des erreurs

Un compilateur lit tout le code avant l'exécution. Il peut donc repérer beaucoup d'erreurs **avant que le programme ne tourne** : variables mal nommées, types incompatibles, fonctions manquantes. Un interpréteur, lui, ne découvre certaines erreurs qu'au moment où il les rencontre — parfois après plusieurs minutes d'exécution. Le langage Rust pousse cette logique très loin : son compilateur attrape même des bugs liés à la mémoire ou à la concurrence.

### Sécurité

Un programme compilé n'a pas besoin de garder son code source en mémoire. Un programme interprété, oui — et beaucoup d'interpréteurs offrent des fonctions comme `eval()` qui permettent d'exécuter du code arbitraire pendant que le programme tourne. C'est puissant, mais c'est aussi un vecteur d'attaque connu. C'est pourquoi MiraMD s'efforce de bloquer `eval()` autant que possible.

### Lisibilité du code livré

Le binaire compilé est très difficile à lire pour un humain : c'est du langage machine. Un programme interprété, lui, est livré en code source clair (ou faiblement minifié). N'importe qui peut l'inspecter. Cela peut être un inconvénient (concurrence) ou un avantage (audit de sécurité, transparence). Pour un projet open source comme MiraMD, c'est neutre : tout le code est public de toute façon.

### Vitesse de développement

Un cycle "modifier le code, voir le résultat" est instantané en interprété : tu sauves le fichier, tu rafraîchis. En compilé classique, tu dois attendre la recompilation, qui peut prendre plusieurs secondes (Rust) à plusieurs minutes (gros projets C++). Les outils modernes atténuent ce désagrément avec la compilation incrémentale, mais l'écart reste réel.

## Le cas MiraMD

MiraMD mélange les deux approches.

- Le **backend Rust** est compilé. Le binaire qu'on télécharge contient toute la logique de fichiers, de préférences, de parsing Markdown, déjà traduite en instructions natives. Il pèse environ 5 MB et tourne sans aucune dépendance externe.
- Le **frontend JavaScript** est interprété par la [WebView](../01-decouverte/glossaire.md#webview) du système d'exploitation, comme une page web normale. C'est la WebView qui fait office d'interpréteur.

### La nuance Svelte

Là où ça se complique : [Svelte](../01-decouverte/glossaire.md#svelte) est, lui, **compilé**. Mais pas vers du langage machine. Il est compilé vers du JavaScript optimisé, qui sera ensuite interprété par la WebView.

Cette double étape a un sens. Pendant le développement, on écrit du code Svelte expressif et concis. Au moment du build, le compilateur Svelte regarde ce code, comprend précisément ce qui doit changer dans la page quand telle variable change, et produit du JavaScript minimal qui fait exactement ça. Pas de framework lourd à embarquer au runtime — juste les instructions nécessaires.

Résultat : MiraMD a un bundle frontend très léger, parce qu'on a fait une partie du travail à la compilation. Ce n'est pas un cas isolé : TypeScript est aussi compilé vers du JavaScript.

## Pour aller plus loin

- Pour comprendre quel runtime exécute quoi dans MiraMD, va voir [`02-fondamentaux/runtime.md`](runtime.md).
- Pour voir le détail de la phase de build (compilation côté Rust et côté frontend), va voir [`04-architecture/build-et-packaging.md`](../04-architecture/build-et-packaging.md).
