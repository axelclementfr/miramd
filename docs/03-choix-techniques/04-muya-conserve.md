# 04 — Conserver Muya tel quel (vendored)

**Date** : 2026-04-29 (décision rétroactive — voir ci-dessous)
**Statut** : adopté, à reconsidérer à moyen terme

## Contexte

[MarkText](https://github.com/marktext/marktext) reposait sur **[Muya](../01-decouverte/glossaire.md#muya)**, un moteur d'édition [WYSIWYG](../01-decouverte/glossaire.md#wysiwyg) Markdown développé spécifiquement pour le projet sur plus de 5 ans. Muya gère :

- la reconnaissance temps réel du Markdown pendant la frappe (taper `# foo` produit immédiatement un titre rendu) ;
- l'historique undo/redo interne ;
- les blocs spécialisés : tableaux, code, math (KaTeX), diagrammes Mermaid, listes de tâches, footnotes ;
- la gestion clavier/souris/drag-drop ;
- le rendu via un [Virtual DOM](../01-decouverte/glossaire.md#virtual-dom) ([Snabbdom](../01-decouverte/glossaire.md#snabbdom), voir [ADR 06](06-snabbdom-pour-le-rendu.md)) ;
- la sanitisation HTML via [DOMPurify](../01-decouverte/glossaire.md#dompurify).

Muya est volumineux (environ 15 000 lignes de code, 28 controller mixins en chaîne sur le prototype `ContentState`), peu testé en interne, et utilise un VDOM custom. Il est aussi **mature** au sens où il a été éprouvé par des dizaines de milliers d'utilisateurs MarkText, dans tous les cas tordus que produisent les utilisateurs réels.

Au moment de la réécriture vers MiraMD, la question s'est posée : **fait-on confiance à Muya ou le remplace-t-on** ?

> Note historique : le fichier [`stack.md`](../../stack.md) à la racine du repo mentionne TipTap comme choix d'éditeur. Cette mention est obsolète : un essai TipTap a été conduit puis abandonné, parce que migrer le format historique de MarkText et reproduire les fonctionnalités spécifiques (tableaux, math inline, Mermaid embarqué) demandait plus d'effort que prévu pour un résultat moins riche. La présente ADR documente la décision réelle : **garder Muya**, vendored.

## Options évaluées

- **Option A — Garder Muya tel quel** : on copie le code source de Muya dans `src/lib/muya/`, on le compile en `static/muya/index.min.js`, et on l'expose comme script global `window.Muya` dans la page. Avantages : 5+ ans de maturité préservés, toutes les fonctionnalités d'édition disponibles, zéro risque de régression sur le format. Inconvénients : on hérite des bugs de Muya (notamment un comportement instable des tableaux), on n'a pas de synchronisation automatique avec d'éventuels patchs upstream MarkText (qui est en maintenance limitée), Muya nécessite `unsafe-eval` dans la [CSP](../01-decouverte/glossaire.md#csp) pour la coloration syntaxique — c'est une dette de sécurité documentée.
- **Option B — Réécrire avec Tiptap (essayé puis abandonné)** : Tiptap est un éditeur rich-text moderne basé sur ProseMirror, avec une extension Markdown (`tiptap-markdown`). Avantages : API moderne, écosystème actif, communauté importante. Inconvénients : Tiptap est conçu pour du rich-text généraliste, pas pour du Markdown WYSIWYG strict. Reproduire les blocs spéciaux de Muya (tableaux éditables clic-pour-ajouter-ligne, math inline LaTeX, Mermaid avec preview live) demandait d'écrire plusieurs extensions sur mesure. Le format produit divergeait subtilement du format MarkText. Abandonné après prototype.
- **Option C — Réécrire sur ProseMirror nu** : ProseMirror est la couche bas-niveau sous Tiptap. Avantages : contrôle total, communauté solide, modèle de données rigoureux (transactions, plugins). Inconvénients : effort énorme (ProseMirror demande de modéliser tout le schéma de document à la main), pas d'extensions prêtes pour Markdown WYSIWYG, courbe d'apprentissage importante. Plusieurs mois de travail pour atteindre la parité fonctionnelle Muya.
- **Option D — Réécrire sur Lexical** : éditeur framework récent de Meta, conçu pour la performance et l'extensibilité. Avantages : architecture moderne, bonne réactivité. Inconvénients : très jeune au moment du choix (peu de retours, API encore mouvante), pas de support Markdown WYSIWYG natif, écosystème embryonnaire.
- **Option E — Réécrire from scratch** : faire son propre moteur WYSIWYG. Avantages : contrôle total, code purement à nous, cohérent avec Svelte. Inconvénients : MarkText a investi plus de 5 ans dans Muya. Refaire en 6 mois ce qu'une équipe a fait en 5 ans, sans bugs, est irréaliste pour un projet à effectif réduit.

## Décision

**Garder Muya, vendored dans `src/lib/muya/`, chargé en script global `window.Muya`.** Le code Muya est compilé séparément (via son propre webpack legacy) en un bundle unique `static/muya/index.min.js`, qui est copié dans le bundle de production Tauri. Côté Svelte, l'accès se fait via un singleton `MuyaService` qui encapsule tous les appels et expose une API propre aux composants.

Pédagogiquement : ce choix est pragmatique, pas idéologique. Muya est l'actif technique le plus précieux dont MiraMD hérite de MarkText. Le réécrire mettrait la qualité d'édition au niveau "alpha" pendant des mois, sans bénéfice clair pour l'utilisateur final. En garder une version figée nous permet de reconstruire **autour** (Tauri, Svelte, Rust) un projet moderne, tout en préservant l'expérience d'édition MarkText.

**Décision rétroactive.** Au démarrage de la réécriture, l'intuition initiale était de tout remplacer (cf. la mention TipTap dans `stack.md`). Le prototype Tiptap a montré que c'était plus coûteux qu'estimé, et un retour à Muya s'est imposé sans formalisation explicite à l'époque. Cet ADR consigne le raisonnement avec le recul.

## Conséquences

**Positives :**
- **5+ ans de maturité d'édition préservés.** Tableaux, math, Mermaid, listes de tâches, footnotes, drag-drop d'images — tout ce que MarkText savait faire, MiraMD le fait.
- **Zéro régression sur le format.** Les fichiers Markdown ouverts dans MarkText sont rendus identiquement dans MiraMD.
- **Architecture découplée** : `MuyaService` est l'unique passerelle. Le jour où on voudrait remplacer Muya, le périmètre à modifier est clairement délimité (tous les services et composants Svelte ne touchent que `MuyaService`, jamais Muya directement).
- **Effort de réécriture économisé** : plusieurs mois de développement gagnés.

**Négatives (la dette qu'on assume) :**
- **Maintenance d'un fork sans sync upstream automatique.** `src/lib/muya/` est figé. Si MarkText publie un patch (ou si un fork community en publie un), il faut le rapatrier manuellement. Aucun outil ne nous alerte.
- **Dette `unsafe-eval` dans la CSP.** Muya utilise `eval()` pour la coloration syntaxique de certains langages. La CSP de MiraMD doit donc inclure `script-src 'unsafe-eval'`, ce qui élargit la surface d'attaque. C'est documenté dans l'audit (section 2). La sortie de cette dette nécessite la sortie de Muya.
- **Bugs Muya hérités.** L'audit identifie plusieurs bugs visibles : tableaux instables, undo/redo capricieux selon le contexte, gestion de la TOC fragile. Ces bugs sont dans Muya ; on peut les contourner mais pas les corriger sans toucher au code vendored.
- **Format historique = boîte noire.** Le format interne de Muya (la structure `ContentState` avec ses 28 mixins) n'est documenté nulle part. Quand on ajoute une feature côté MiraMD, on doit reverse-engineer Muya à coups de `console.log`.
- **Pas de TypeScript** : le code Muya est en JavaScript pur. L'API est typée à la main dans `src/lib/types/muya-instance.ts`. Si Muya évolue, le typage diverge silencieusement.
- **Couplage à Snabbdom** : Muya utilise Snabbdom comme VDOM. Sortir de Muya = sortir de Snabbdom. Voir [ADR 06](06-snabbdom-pour-le-rendu.md).
- **Chargement en script global `window.Muya`** : ce n'est pas un module ES propre. Le typage TypeScript se fait via `(window as any).Muya`, ce qui réduit la sûreté.
- **Pas de tests unitaires Muya côté MiraMD.** Le composant `MuyaPane.svelte`, le plus complexe, n'a pas de test direct. C'est documenté dans l'audit (section 8).

**À reconsidérer si...** La balance bascule (et il faudra remettre l'ADR à plat) si :
- un fork community de Muya émerge avec un mainteneur actif ;
- un éditeur WYSIWYG Markdown moderne atteint une parité fonctionnelle suffisante (équivalent Mermaid intégré, math LaTeX inline, tableaux éditables) ;
- les bugs Muya bloquent l'expérience utilisateur au point de rendre l'app inutilisable ;
- la dette `unsafe-eval` devient un problème pour une certification ou un déploiement entreprise.

## Pour aller plus loin

- [Vue d'ensemble de l'architecture](../04-architecture/vue-densemble.md) — la place de Muya dans la couche 2.
- [WYSIWYG](../02-fondamentaux/wysiwyg.md) — qu'est-ce qu'un éditeur WYSIWYG.
- [06 — Snabbdom pour le rendu](06-snabbdom-pour-le-rendu.md) — le VDOM utilisé par Muya.
- [Glossaire — Muya](../01-decouverte/glossaire.md#muya), [Snabbdom](../01-decouverte/glossaire.md#snabbdom), [DOMPurify](../01-decouverte/glossaire.md#dompurify), [Singleton](../01-decouverte/glossaire.md#singleton).
- Audit, sections 1 (Architecture), 2 (Sécurité — `unsafe-eval`) et 8 (Tests) dans [`06-references/audit.md`](../06-references/audit.md).
