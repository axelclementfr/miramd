# WYSIWYG

[WYSIWYG](../01-decouverte/glossaire.md#wysiwyg) signifie *What You See Is What You Get* : "ce que tu vois est ce que tu obtiens". C'est une approche d'édition où le rendu final s'affiche pendant que tu tapes, plutôt qu'une syntaxe brute qu'il faudrait prévisualiser à part.

## Trois façons d'éditer du texte

Pour bien situer le WYSIWYG, il faut le mettre en regard de deux autres approches.

### Word : le WYSIWYG strict

Quand tu écris dans Microsoft Word ou LibreOffice, tu ne vois jamais de syntaxe. Tu cliques sur le bouton "gras", le texte devient gras à l'écran. Tu sélectionnes une taille de police, le texte change. Tout est visuel. Le fichier sauvegardé (`.docx`) est un format binaire complexe que tu ne lis jamais directement.

C'est confortable, mais le format est lourd, propriétaire, et difficile à manipuler avec d'autres outils.

### Bloc-notes : la source brute

Quand tu écris dans Notepad ou nano, tu vois exactement les caractères du fichier. Aucune mise en forme, aucune transformation. Si tu écris du Markdown dans le Bloc-notes, tu vois les `#` des titres, les `**` du gras, les `-` des listes. C'est moche à lire mais tu maîtrises chaque octet.

C'est puissant pour les développeurs, mais inconfortable pour la lecture longue.

### MiraMD : le WYSIWYG sur Markdown

MiraMD propose une troisième voie. Tu tapes du [Markdown](../01-decouverte/glossaire.md#markdown), mais tu vois le rendu en temps réel. Tu écris `# Titre` et la ligne devient un titre stylé. Tu écris `**gras**` et le texte se met en gras dès que tu fermes les deux étoiles. Tu n'as pas besoin de cliquer sur des boutons, et tu n'as pas besoin de voir la syntaxe en permanence.

Le fichier sauvegardé reste un `.md` ouvrable dans n'importe quel éditeur. Tu gardes le confort visuel **et** la portabilité du texte brut.

C'est ce qu'on appelle parfois "WYSIWYG hybride" ou "Markdown vivant". Typora a popularisé cette approche, MarkText l'a reprise, MiraMD l'hérite via [Muya](../01-decouverte/glossaire.md#muya).

## Pourquoi c'est techniquement difficile

Faire du WYSIWYG sur Markdown demande plus d'ingénierie qu'on ne l'imagine. Quatre défis se cumulent.

### Reconnaissance temps réel

Chaque frappe peut potentiellement transformer le rendu. Quand tu tapes `**`, rien ne change. Quand tu tapes `**foo**`, le mot doit devenir gras. Mais pas tant que tu n'as pas tapé la deuxième paire d'étoiles — sinon le rendu sauterait à chaque caractère intermédiaire. Le moteur doit comprendre où en est la syntaxe **à chaque instant**, et décider quand appliquer la transformation.

### Gestion du curseur

Dans un éditeur source, le curseur est simple : il vit entre deux caractères du texte brut. Dans un éditeur WYSIWYG, le texte affiché n'est plus le texte source — il est transformé. Si tu cliques entre le "f" et le "o" de "**foo**", le moteur doit savoir où c'est dans le Markdown sous-jacent. Si tu appuies sur la flèche droite, le curseur doit franchir les `**` invisibles **dans le bon sens**, sans visiter des positions absurdes.

### Undo/redo cohérent

Quand tu appuies sur Ctrl+Z, tu t'attends à revenir à l'état précédent. Mais "l'état" n'est pas trivial : il faut restaurer **le texte source**, **la position du curseur**, et **la sélection**, le tout cohérent avec le rendu visuel. Faire un historique fiable est un sujet à part entière.

### Sélections complexes

Un utilisateur peut sélectionner une plage qui traverse plusieurs blocs (titre, paragraphe, liste). Le copier-coller doit produire un Markdown bien formé. Le couper doit recoller proprement. Coller du HTML depuis le presse-papier doit le convertir en Markdown sain.

### IME et claviers internationaux

Les utilisateurs japonais, chinois, coréens utilisent une *Input Method Editor* (IME) qui compose les caractères en plusieurs étapes : tu tapes en alphabet latin, l'IME te propose des candidats, tu valides. Pendant la composition, le texte est dans un état intermédiaire. L'éditeur ne doit **pas** déclencher de transformation Markdown tant que la composition n'est pas terminée — sinon il perturbe l'IME et l'utilisateur tape n'importe quoi.

### Accessibilité

Un éditeur WYSIWYG doit rester navigable au clavier seul, lisible par un lecteur d'écran, compatible avec les modes haut-contraste. Tout en transformant le texte en temps réel. Les frameworks d'éditeur matures (ProseMirror, Lexical) consacrent une part significative de leur code à ces sujets.

## Le cas MiraMD

[Muya](../01-decouverte/glossaire.md#muya) est le moteur d'édition WYSIWYG de MiraMD. Il a été créé pour MarkText et a quelques années de maturité derrière lui. MiraMD le réutilise tel quel, vendored dans `src/lib/muya/` et compilé en `static/muya/index.min.js`.

### Ce qu'il fait bien

- Reconnaissance temps réel de la plupart des constructions Markdown (titres, gras, italique, code inline, listes, liens, images, citations, blocs de code avec coloration).
- Historique undo/redo interne avec snapshot par onglet.
- Six modes d'édition (WYSIWYG, source, split, lecture seule, focus, machine à écrire).
- Toolbar contextuel flottant.
- Gestion des sélections multi-blocs.

### Limites connues

Muya n'est pas parfait. Quelques zones fragiles ont été identifiées et sont documentées ailleurs :

- **Tableaux** : le rendu et l'édition de tableaux Markdown sont parfois capricieux (cellules qui sautent, navigation au clavier imparfaite).
- **Ctrl+Z sur Linux** : [WebKitGTK](../01-decouverte/glossaire.md#webkitgtk) ne déclenche pas le `undo` natif sur un champ `contenteditable`. MiraMD intercepte le raccourci dans `MuyaPane.svelte` et appelle l'historique Muya à la main.
- **`unsafe-eval` dans la [CSP](../01-decouverte/glossaire.md#csp)** : Muya utilise `eval()` pour la coloration syntaxique, ce qui force l'autorisation de `unsafe-eval`. Le risque est contenu (sandbox Tauri stricte), mais c'est une dette à connaître.
- **Pas de collaboration temps réel** : Muya ne supporte pas les CRDT/OT, donc pas de mode multi-utilisateurs.
- **Performance sur très gros fichiers** : au-delà de quelques milliers de lignes, le DOM complet est reconstruit à chaque changement, sans virtualisation.

Ces limites sont assumées. Le coût d'écrire un nouvel éditeur WYSIWYG (TipTap, Milkdown, ProseMirror sur mesure) a été pesé et écarté pour la v1. Le détail de la décision vit dans [`03-choix-techniques/04-muya-conserve.md`](../03-choix-techniques/04-muya-conserve.md).

### Pourquoi ne pas faire un éditeur source pur

L'argument est tentant : un éditeur Markdown source est plus simple à coder, plus fiable, plus rapide. Pourquoi se compliquer avec du WYSIWYG ?

Parce que la cible de MiraMD n'est pas le développeur seul. Beaucoup d'utilisateurs de Markdown sont rédacteurs, chercheurs, étudiants, journalistes, qui n'ont aucune envie de voir des `**` partout dans leur texte. Le WYSIWYG abaisse la barrière d'entrée : on tape comme dans Word, on a un fichier portable comme avec un éditeur source.

### Six modes d'édition

MiraMD expose six manières d'utiliser le moteur Muya, chacune adaptée à un cas :

- **WYSIWYG** : le mode par défaut, rendu en temps réel, syntaxe invisible.
- **Source** : le Markdown brut, pour celles et ceux qui préfèrent voir leur syntaxe.
- **Split** : deux panneaux côte à côte, source à gauche, rendu à droite.
- **Lecture seule** : le rendu sans possibilité de modification, utile pour partager une note.
- **Focus** : seul le paragraphe courant est en pleine opacité, le reste s'estompe.
- **Machine à écrire** : la ligne courante reste verticalement centrée pendant que tu tapes.

Ces modes sont gérés par un service dédié (`editorModes`) qui pilote Muya via le wrapper `MuyaService`.

## Pour aller plus loin

- Pour comprendre comment Muya est branché à MiraMD côté Svelte, va voir [`04-architecture/integration-muya.md`](../04-architecture/integration-muya.md).
- Pour la décision de garder Muya plutôt que de le remplacer, va voir [`03-choix-techniques/04-muya-conserve.md`](../03-choix-techniques/04-muya-conserve.md).
- Pour les bugs et limites connus en détail, va voir le dossier [`05-fonctionnalites/`](../05-fonctionnalites/).
