# 02 — Svelte 5 plutôt que Vue ou React

**Date** : 2026-04-29 (décision prise au démarrage de la réécriture, formalisée a posteriori)
**Statut** : adopté

## Contexte

Une fois [Tauri](../01-decouverte/glossaire.md#tauri) retenu (voir [ADR 01](01-tauri-vs-electron.md)), il fallait choisir le [framework](../01-decouverte/glossaire.md#framework) qui ferait tourner l'interface dans la [WebView](../01-decouverte/glossaire.md#webview). Trois contraintes orientaient le choix :

- **Footprint** : on a basculé vers Tauri pour faire tomber la taille de l'app à ~5 Mo. Embarquer 100 Ko de runtime UI dans le bundle n'est pas dramatique, mais reste cohérent avec la philosophie de légèreté.
- **MarkText était sous Vue 2** : Vue 2 est en fin de support (maintenance only depuis fin 2023). On ne peut pas reprendre tel quel.
- **Productivité** : il fallait quelque chose de moderne, bien typé en TypeScript, capable de gérer une interface modale (onglets, panneaux, settings) sans ajouter une couche de gestion d'état lourde.

L'équipe partait quasiment de zéro côté UI : la quasi-totalité de l'éditeur lui-même est dans [Muya](../01-decouverte/glossaire.md#muya), donc le framework UI ne gère que la coque (titre, onglets, panneaux, dialogues, paramètres).

## Options évaluées

- **Option A — [Svelte](../01-decouverte/glossaire.md#svelte) 5** : framework qui **compile** les composants en JavaScript natif, sans [Virtual DOM](../01-decouverte/glossaire.md#virtual-dom) ni runtime alourdi. Avantages : runtime ~2 Ko, [stores](../01-decouverte/glossaire.md#store-svelte) [réactifs](../01-decouverte/glossaire.md#reactivite) intégrés, syntaxe proche du HTML, support TypeScript excellent, scaffold Tauri officiel. Inconvénients : écosystème plus petit que Vue/React, Svelte 5 (runes) très récent au moment du choix — peu de retours d'expérience, peu de bibliothèques tierces compatibles.
- **Option B — Vue 3** : continuité naturelle depuis Vue 2 (l'équipe pourrait réutiliser des connaissances). Avantages : écosystème mature, Pinia pour le state, beaucoup de bibliothèques de composants. Inconvénients : embarque un Virtual DOM (~33 Ko de runtime), nécessite un store externe (Pinia) qu'il faut intégrer, la migration depuis Vue 2 n'est pas triviale (Composition API, syntaxe `<script setup>`). Pour un projet où l'on récrit tout, cet avantage de continuité s'évanouit.
- **Option C — React 18** : standard de fait dans l'industrie. Avantages : énorme écosystème, beaucoup de talents, hooks bien rodés. Inconvénients : runtime ~42 Ko, JSX plus verbeux que Svelte ou les SFC Vue, gestion d'état externalisée (Redux, Zustand, Jotai...), réactivité plus implicite (re-renders à surveiller).
- **Option D — SolidJS** : philosophie proche de Svelte (réactivité fine, pas de Virtual DOM), mais via une API JSX. Avantages : performances de pointe, JSX familier pour les développeurs React. Inconvénients : écosystème encore plus petit que Svelte, moins de support tooling/IDE, pas de scaffold Tauri officiel à l'époque.
- **Option E — Vanilla JS / TypeScript** : pas de framework du tout. Avantages : zéro dépendance UI, contrôle total. Inconvénients : il faudrait réinventer la réactivité, la gestion des composants, les stores. Beaucoup de roue à réinventer pour une économie marginale.

## Décision

**Svelte 5.** Le runtime quasi nul (compilation directe vers du DOM, pas de [Virtual DOM](../01-decouverte/glossaire.md#virtual-dom)) s'aligne avec la philosophie Tauri de légèreté. Les stores réactifs intégrés évitent d'ajouter Pinia ou Redux pour les ~4 stores que MiraMD utilise (`editor`, `preferences`, `toast`, `muyaInstance`). La syntaxe Svelte est proche du HTML, ce qui simplifie l'apprentissage pour un nouveau contributeur.

Pédagogiquement : Svelte n'est pas tout à fait comme React ou Vue. Au lieu d'avoir un runtime qui interprète tes composants à chaque mise à jour, **Svelte les transforme à la compilation en JavaScript qui modifie chirurgicalement le [DOM](../01-decouverte/glossaire.md#dom)**. Concrètement, quand un store change, Svelte sait exactement quelles lignes de code mettre à jour dans la page, sans recalculer un arbre virtuel et sans diff. C'est plus rapide et plus léger.

Décision adoptée a posteriori : il n'y a pas eu de matrice de décision écrite à l'époque, mais la combinaison "Tauri scaffold officiel pour Svelte" + "runtime minimal" + "TypeScript first-class" a tranché rapidement.

## Conséquences

**Positives :**
- Bundle frontend très léger (le runtime Svelte compilé pèse quelques Ko, pas des dizaines).
- Pas besoin d'un store externe : `writable`, `derived`, `readable` couvrent tous les besoins.
- TypeScript fonctionne très bien (avec `svelte-check` en complément du compilateur TS).
- Réactivité implicite mais explicite : `$store` est lisible et déclaratif.
- SvelteKit (utilisé en mode SPA) fournit le routing et la structure de l'app.

**Négatives (la dette qu'on assume) :**
- **Écosystème plus petit.** Pour des composants UI courants (date pickers, autocomplete, tree views), il y a moins d'options qu'en React ou Vue. Conséquence : plusieurs composants de MiraMD sont écrits maison.
- **Svelte 5 est très récent** au moment du choix. La syntaxe runes (`$state`, `$derived`, `$effect`) a remplacé l'ancienne (`let` réactif, `$:`). Peu de retours d'expérience à long terme, peu de tutoriels actualisés. Risque que certaines bibliothèques tierces ne soient pas encore compatibles runes.
- **Pas de Virtual DOM** : c'est un avantage perf, mais ça veut dire qu'on ne peut pas utiliser un outil comme React DevTools qui inspecte un VDOM. Le seul VDOM dans le projet est celui de [Snabbdom](../01-decouverte/glossaire.md#snabbdom) à l'intérieur de Muya (voir [ADR 06](06-snabbdom-pour-le-rendu.md)).
- Le typage Svelte (`*.svelte` files) est moins bien intégré dans certains éditeurs que React + JSX.
- Pour un nouveau contributeur qui vient de React, le mental model "compiler le composant" demande un temps d'adaptation.

## Pour aller plus loin

- [Vue d'ensemble de l'architecture](../04-architecture/vue-densemble.md) — la place de Svelte dans la couche 1.
- [Réactivité (Svelte)](../02-fondamentaux/reactivite.md) — comment fonctionne la réactivité de Svelte concrètement.
- [Virtual DOM](../02-fondamentaux/virtual-dom.md) — pourquoi Svelte n'en a pas besoin et ce que ça change.
- [Glossaire — Svelte](../01-decouverte/glossaire.md#svelte), [Store](../01-decouverte/glossaire.md#store-svelte), [Hook](../01-decouverte/glossaire.md#hook-reactsvelteetc).
- Audit, section 7 (Frontend / Tauri) dans [`06-references/audit.md`](../06-references/audit.md).
