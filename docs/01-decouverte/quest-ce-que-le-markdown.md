# Qu'est-ce que le Markdown ?

Le [Markdown](glossaire.md#markdown) est un format texte où l'on indique la mise en forme avec **quelques caractères ordinaires** plutôt qu'avec des boutons ou des balises invisibles. Inventé en 2004 par John Gruber, il s'est imposé comme le standard pour les README, la documentation logicielle, les notes, et de plus en plus la rédaction longue.

## C'est quoi, concrètement ?

Quand tu écris un document Markdown, tu tapes du **texte normal**. Pour donner une forme à ce texte, tu ajoutes ici et là quelques caractères convenus. C'est lisible directement, et ça se transforme en mise en page propre quand un outil rend le document.

Par exemple, ce code Markdown…

```markdown
# Mon premier titre

Un paragraphe avec du **texte en gras** et de l'*italique*.

- Premier élément
- Deuxième élément
- Troisième élément

[Un lien vers le site](https://example.com)
```

…est rendu comme ceci :

> # Mon premier titre
>
> Un paragraphe avec du **texte en gras** et de l'*italique*.
>
> - Premier élément
> - Deuxième élément
> - Troisième élément
>
> [Un lien vers le site](https://example.com)

## Les règles de base

Voici les conventions que tu utiliseras 90 % du temps :

| Tu tapes | Tu obtiens |
|---|---|
| `# Titre niveau 1` | Un grand titre |
| `## Titre niveau 2` | Un sous-titre |
| `**gras**` | **gras** |
| `*italique*` | *italique* |
| `` `code` `` | du code en ligne |
| `- élément` | un point dans une liste à puces |
| `1. élément` | un point dans une liste numérotée |
| `> citation` | un bloc de citation |
| `[texte](https://url)` | un lien cliquable |
| `![texte](image.png)` | une image |

Et pour des blocs de code complets :

````markdown
```python
print("Hello")
```
````

L'éditeur les colorie automatiquement selon le langage.

## Pourquoi c'est utile

Le Markdown a trois qualités qui expliquent sa popularité :

### Portable

Un fichier `.md` est juste **du texte**. Il s'ouvre avec n'importe quel éditeur sur n'importe quel système d'exploitation. Pas de format propriétaire, pas de version qui devient illisible dans dix ans.

### Versionnable

Comme c'est du texte, [git](https://git-scm.com) et autres outils de gestion de versions le suivent ligne par ligne. Tu peux voir précisément ce qui a changé entre deux révisions, fusionner les contributions de plusieurs personnes, revenir en arrière. Essaie de faire ça avec un `.docx`.

### Lisible directement

Même sans rendu, le texte brut reste lisible. Une liste reste une liste, un titre reste reconnaissable. Si l'outil de rendu disparaît, le contenu n'est pas perdu.

## Différence avec Word ou LibreOffice

| | Word / LibreOffice | Markdown |
|---|---|---|
| Format | binaire (`.docx`, `.odt`) | texte (`.md`) |
| Compatibilité dans 20 ans | dépend de l'éditeur | n'importe quel éditeur de texte |
| Contrôle de version | difficile | natif (git diff fonctionne) |
| Édition collaborative | nécessite un service | suffit de partager le fichier |
| Effort visuel pendant l'écriture | beaucoup (mise en forme manuelle) | minimal (focus sur le contenu) |

Le Markdown ne remplace pas un traitement de texte pour tous les usages — il n'a pas de concept de page, de marge, ou de mise en page complexe. Mais pour de la rédaction où **le contenu compte plus que la forme exacte**, c'est un outil bien plus efficace.

## WYSIWYG ou source ?

Deux philosophies coexistent pour éditer du Markdown :

- **Mode source** — tu vois la syntaxe brute (`# Titre`, `**gras**`) et tu apprends à la lire. C'est l'approche des éditeurs de code (VS Code, Sublime).
- **Mode [WYSIWYG](glossaire.md#wysiwyg)** — tu vois le rendu pendant que tu tapes : tu écris `# `, et le mot suivant apparaît directement comme un titre. La syntaxe ne reste affichée que quand le curseur est à proximité.

MiraMD est un éditeur **[WYSIWYG](glossaire.md#wysiwyg)** par défaut, grâce à son moteur [Muya](glossaire.md#muya). Tu peux basculer en mode source quand tu veux, ou afficher les deux côte à côte. Voir [`../02-fondamentaux/wysiwyg.md`](../02-fondamentaux/wysiwyg.md) pour le détail.

## CommonMark et GFM

À l'origine, la spécification du Markdown était un peu floue, et différents outils ne l'interprétaient pas exactement de la même façon. Deux standards ont émergé pour clarifier les choses :

- **[CommonMark](https://commonmark.org)** — spécification stricte qui décrit précisément le comportement attendu pour chaque construction. C'est le socle commun.
- **GFM (GitHub Flavored Markdown)** — extension de CommonMark avec des ajouts populaires : tableaux, listes de tâches (`- [ ]`), `~~barré~~`, blocs de code repérés par leur langage, mentions, etc.

MiraMD comprend **CommonMark + GFM**, plus quelques extensions courantes (notes de bas de page, expressions mathématiques en LaTeX). Le rendu et l'analyse passent par [comrak](glossaire.md#comrak), une bibliothèque [Rust](glossaire.md#rust) qui implémente fidèlement les deux spécifications.

## Pour aller plus loin

- Tutoriel pas à pas : [The Markdown Guide](https://www.markdownguide.org).
- [`../02-fondamentaux/wysiwyg.md`](../02-fondamentaux/wysiwyg.md) — comment fonctionne le mode WYSIWYG en détail.
- [`installation.md`](installation.md) — pour installer MiraMD et essayer.
- [`premiere-utilisation.md`](premiere-utilisation.md) — premier tour de l'application.
