# 06 — Snabbdom comme Virtual DOM interne à Muya

**Date** : 2026-04-29 (décision héritée de MarkText, formalisée a posteriori)
**Statut** : adopté

## Contexte

[Muya](../01-decouverte/glossaire.md#muya) a besoin, en interne, d'une **représentation modifiable du [DOM](../01-decouverte/glossaire.md#dom)** pour reconstruire l'affichage de l'éditeur quand le contenu change. Concrètement, à chaque frappe l'utilisateur peut transformer un paragraphe en titre, ajouter une cellule de tableau, fermer un bloc de code — autant d'opérations qui modifient potentiellement plusieurs nœuds DOM. Reconstruire le DOM "à la main" à chaque modification serait lent et bug-prone.

C'est exactement ce que résout un [Virtual DOM](../01-decouverte/glossaire.md#virtual-dom) : Muya construit un arbre virtuel à partir de son `ContentState`, puis une bibliothèque calcule la différence avec l'arbre précédent et applique uniquement les changements minimaux au DOM réel.

Important à noter : **MiraMD utilise [Svelte](../01-decouverte/glossaire.md#svelte) côté UI Svelte, qui n'a PAS de Virtual DOM** (voir [ADR 02](02-svelte-vs-vue-react.md)). Le seul VDOM dans MiraMD est celui de Muya. Les deux mondes sont étanches : Svelte ne touche jamais l'arbre Snabbdom, et Muya ne sait rien des composants Svelte.

## Options évaluées

- **Option A — [Snabbdom](../01-decouverte/glossaire.md#snabbdom)** : bibliothèque Virtual DOM minimaliste écrite en TypeScript, environ 200 lignes pour le coeur. Avantages : très léger (~5 Ko gzippé), modulaire (fonctionnalités via modules), bien testé, stable depuis des années, c'est le choix historique de MarkText pour Muya. Inconvénients : pas de typage natif TypeScript (les types existent mais sont moins riches que React/Vue), écosystème de plugins très restreint, pas d'API "moderne" (hooks, suspense, etc.).
- **Option B — virtual-dom (npm)** : la bibliothèque historique d'Elm-influenced VDOM en JavaScript, par Matt Esch. Avantages : encore plus simple que Snabbdom, philosophie purement fonctionnelle. Inconvénients : peu maintenue, écosystème quasi mort, pas de typage TypeScript correct.
- **Option C — Écrire son propre VDOM** : Muya pourrait avoir son propre moteur de diff. Avantages : contrôle total, pas de dépendance externe. Inconvénients : un VDOM correct est étonnamment difficile à écrire (gestion des clés, des événements, des focus, des selections). Réinventer la roue pour économiser 5 Ko n'a pas de sens.

## Décision

**Snabbdom**, héritage direct de MarkText. La décision a été prise par les auteurs de MarkText il y a plusieurs années, et MiraMD la conserve telle quelle puisque le moteur d'édition Muya est conservé (voir [ADR 04](04-muya-conserve.md)).

Pédagogiquement : un VDOM est utile quand **on ne sait pas, à l'avance, quelles parties du DOM vont changer**. Muya manipule un état complexe (un arbre de blocs Markdown qui peuvent se transformer les uns en les autres) et doit redessiner partiellement à chaque frappe. Snabbdom permet d'écrire la fonction "à partir de cet état, voici à quoi le DOM doit ressembler", et il s'occupe de calculer le delta avec ce qui est déjà à l'écran.

Décision rétroactive : MiraMD ne réévalue pas ce choix séparément. Il fait partie du paquet "Muya conservé". Le présent ADR existe pour expliciter ce que cela implique.

## Conséquences

**Positives :**
- **Léger** : Snabbdom pèse environ 5 Ko gzippé, ce qui n'alourdit pas le bundle Muya.
- **Stable** : la bibliothèque a peu évolué ces dernières années — c'est plutôt une bonne nouvelle, signe qu'elle est mûre.
- **Bien testé en production** : utilisé dans Muya depuis 5+ ans, sur des dizaines de milliers d'installations MarkText.
- **Modulaire** : Snabbdom se compose via des modules optionnels (gestion d'événements, attributs, classes, styles). On charge uniquement ce qu'on utilise.

**Négatives (la dette qu'on assume) :**
- **Couplage avec Muya.** Le jour où on voudrait sortir de Muya (cf. ADR 04), on sort aussi de Snabbdom. Les deux sont entrelacés : remplacer Muya par un autre éditeur (ProseMirror, Lexical) implique d'adopter le système de rendu de cet autre éditeur.
- **Pas de typage TypeScript natif riche.** Snabbdom expose des types, mais ils sont moins fins que ceux de React ou Vue. Comme Muya est de toute façon en JavaScript pur, ça ne change pas grand-chose dans le contexte MiraMD.
- **Écosystème confidentiel.** Si on a besoin d'un comportement particulier (par exemple, server-side rendering), il n'y a pas de plugin "officiel". On doit l'écrire soi-même. Ce besoin n'existe pas dans MiraMD, mais c'est une limite à connaître.
- **Pas de DevTools** : impossible d'inspecter l'arbre Snabbdom dans une extension navigateur, contrairement à React DevTools ou Vue DevTools. Pour débugger un rendu Muya, on doit tracer dans le code.

## Pour aller plus loin

- [04 — Muya conservé](04-muya-conserve.md) — l'ADR parent qui justifie de garder tout l'écosystème Muya, y compris Snabbdom.
- [Virtual DOM](../02-fondamentaux/virtual-dom.md) — qu'est-ce qu'un VDOM, pourquoi Svelte n'en a pas et Muya en a un.
- [Vue d'ensemble de l'architecture](../04-architecture/vue-densemble.md) — la couche 2 (Muya) dans le système.
- [Glossaire — Snabbdom](../01-decouverte/glossaire.md#snabbdom), [Virtual DOM](../01-decouverte/glossaire.md#virtual-dom), [DOM](../01-decouverte/glossaire.md#dom).
- Le repo Snabbdom : [github.com/snabbdom/snabbdom](https://github.com/snabbdom/snabbdom) pour explorer l'API.
