# 05 — comrak pour le parsing Markdown côté backend

**Date** : 2026-04-29 (décision prise au démarrage de la réécriture, formalisée a posteriori)
**Statut** : adopté

## Contexte

Le [backend](../01-decouverte/glossaire.md#backend) [Rust](../01-decouverte/glossaire.md#rust) (voir [ADR 03](03-rust-pour-le-backend.md)) doit pouvoir **parser du [Markdown](../01-decouverte/glossaire.md#markdown)** pour plusieurs usages :

- valider qu'un fichier ouvert est bien du Markdown (pré-vérification avant ouverture) ;
- extraire des statistiques (nombre de mots, nombre de paragraphes, etc.) ;
- à l'avenir, fournir une commande IPC `extract_headings` pour produire une table des matières fiable côté frontend (à ce jour la TOC est extraite par regex côté Svelte, ce qui est fragile — voir l'audit, section 6) ;
- à l'avenir, peut-être générer un export HTML côté backend.

Côté frontend, c'est [Muya](../01-decouverte/glossaire.md#muya) qui parse le Markdown pour le rendu WYSIWYG, avec son propre tokenizer. Mais Muya n'est pas accessible depuis Rust, et délégant au backend permet d'avoir une **source de vérité** pour les opérations de validation et d'extraction.

Il fallait donc choisir un parser Markdown Rust mature, supportant GFM ([GitHub Flavored Markdown](https://github.github.com/gfm/)), et configurable pour la sécurité (pas d'exécution de HTML brut).

## Options évaluées

- **Option A — [comrak](../01-decouverte/glossaire.md#comrak)** : parser Markdown Rust développé par Asherah Connor, conçu pour être compatible CommonMark + GFM. Avantages : GFM complet (tables, footnotes, math, tasklists, autolinks, strikethrough, superscript, description lists), maintenu activement, configuration claire (`ComrakOptions` avec `unsafe_=false`), API simple. Inconvénients : un peu plus lourd que pulldown-cmark en compilation et en runtime (l'AST est entièrement matérialisé).
- **Option B — pulldown-cmark** : parser Markdown Rust streaming, utilisé notamment par mdBook et le compilateur Rust pour rustdoc. Avantages : très rapide en micro-benchmarks, allocation minimale (parser à événements), bien intégré à l'écosystème Rust officiel. Inconvénients : GFM partiel (pas de footnotes natives, pas de math, pas de superscript), API événementielle plus difficile à manipuler pour des manipulations d'arbre (extraction de headings hiérarchiques par exemple).
- **Option C — markdown-rs (md4)** : parser Markdown Rust expérimental, port de micromark (JS). Avantages : architecture propre, conforme CommonMark. Inconvénients : moins mature que comrak ou pulldown-cmark, écosystème encore en construction, support GFM partiel.

## Décision

**comrak.** Il offre le support [GFM](https://github.github.com/gfm/) complet hors de la boîte, configuration sûre (`unsafe_=false` strippe les balises `<script>` et le HTML brut), et une API qui produit un AST manipulable (utile pour l'extraction de headings). C'est aussi le parser que GitHub utilise en production sur github.com — gage de robustesse.

Pédagogiquement : un parser Markdown ne se contente pas de transformer du texte en HTML. Il doit décider comment interpréter les ambiguïtés (un `*` sans paire, un lien malformé, un bloc de code non fermé), gérer les extensions GFM (tables, listes de tâches), et idéalement permettre de **manipuler l'arbre** (par exemple pour en extraire les titres). comrak coche toutes ces cases.

Configuration retenue dans `markdown.rs` :
- `extension.table = true` (tables GFM)
- `extension.tasklist = true` (cases à cocher)
- `extension.strikethrough = true` (`~~barré~~`)
- `extension.autolink = true` (URLs détectées automatiquement)
- `extension.footnotes = true` (`[^1]`)
- `extension.math_dollars = true` (`$math$` et `$$math$$`)
- `render.unsafe_ = false` (HTML brut ignoré)

Décision adoptée a posteriori : pas de matrice de comparaison écrite à l'époque, mais comrak s'est imposé comme le seul parser Rust supportant l'ensemble GFM + footnotes + math que MarkText savait gérer côté JavaScript via marked.js.

## Conséquences

**Positives :**
- **GFM complet sans bricolage** : tables, footnotes, listes de tâches, math, superscript fonctionnent dès l'installation.
- **Configuration sécurité explicite** : `unsafe_=false` empêche l'injection HTML, validé en test (`tests/markdown.rs`).
- **Maintenance active** : comrak est versionné, compatible CommonMark 0.31, suivi des évolutions GFM.
- **Performances correctes** : le backend parse un fichier de 100 Ko en moins d'1 ms (mesuré dans les tests d'intégration).
- **AST manipulable** : la version 0.36 expose un AST sur lequel on peut walker pour extraire des headings, des liens, etc. Préparation pour la future commande `extract_headings`.

**Négatives (la dette qu'on assume) :**
- **Plus lourd que pulldown-cmark** : compilation un peu plus longue, AST entièrement en mémoire (pas de streaming). Pour un fichier de 50 Mo (limite haute de MiraMD), c'est encore acceptable mais plus de RAM mobilisée que nécessaire.
- **API différente de marked.js** : MarkText utilisait marked.js côté JS pour ses propres usages (notamment l'export HTML). Si à terme on veut faire fonctionner les deux (Muya côté frontend, comrak côté backend) sur le même document, il peut y avoir des **divergences subtiles** dans l'interprétation (par exemple, un cas d'auto-link mal formé peut être traité différemment). Aucun cas critique observé à ce jour, mais le risque existe.
- **Pas de cache** : à chaque appel `parse_markdown` ou `extract_stats`, on re-parse depuis zéro. Acceptable car les appels sont [debouncés](../01-decouverte/glossaire.md#debounce) côté frontend, mais sur de gros fichiers ça peut peser.
- **Verrou de version** : un changement breaking dans comrak (par exemple, une nouvelle structure d'AST) demande de refaire les fonctions d'extraction. À surveiller à chaque major.

## Pour aller plus loin

- [Vue d'ensemble de l'architecture](../04-architecture/vue-densemble.md) — comment le backend Rust expose les commandes IPC.
- [03 — Rust pour le backend](03-rust-pour-le-backend.md) — pourquoi le parser est côté Rust et pas côté JS.
- [Glossaire — comrak](../01-decouverte/glossaire.md#comrak), [Parser](../01-decouverte/glossaire.md#parser), [Markdown](../01-decouverte/glossaire.md#markdown).
- Audit, sections 1 et 6 (Architecture, Maintenabilité — TOC extraction naïve) dans [`06-references/audit.md`](../06-references/audit.md).
- Spécification [GitHub Flavored Markdown](https://github.github.com/gfm/) pour comprendre l'étendue de ce que comrak couvre.
