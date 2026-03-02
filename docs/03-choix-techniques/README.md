# Choix techniques (ADRs)

Ce dossier rassemble les **Architecture Decision Records** ([ADR](../01-decouverte/glossaire.md#adr)) de MiraMD.

Un ADR est un document court qui consigne **une décision technique** prise à un moment donné. Il décrit :

- le **contexte** (le problème à résoudre, les contraintes du moment) ;
- les **options évaluées** (avec leurs avantages et inconvénients) ;
- la **décision** retenue, avec sa justification ;
- les **conséquences** assumées, bonnes comme mauvaises.

Les ADRs ne sont pas des pages marketing. Ils existent pour qu'un nouveau contributeur — ou le futur mainteneur — comprenne **pourquoi** une décision a été prise, et puisse la remettre en question avec les bons arguments si le contexte change.

Plusieurs des ADRs ci-dessous ont été rédigés **a posteriori** : la décision a été prise au moment de la réécriture de MarkText, sans formalisation explicite. Le document existe pour documenter le raisonnement avec le recul. C'est honnête : il n'y a pas eu d'évaluation formelle écrite à l'époque pour la plupart des choix.

## Liste des ADRs

- [01 — Tauri vs Electron](01-tauri-vs-electron.md) — pourquoi MiraMD n'est pas une app Electron.
- [02 — Svelte vs Vue/React](02-svelte-vs-vue-react.md) — pourquoi le framework UI est [Svelte](../01-decouverte/glossaire.md#svelte) 5.
- [03 — Rust pour le backend](03-rust-pour-le-backend.md) — pourquoi le backend est en [Rust](../01-decouverte/glossaire.md#rust) et pas en Node.js ou Go.
- [04 — Muya conservé](04-muya-conserve.md) — pourquoi le moteur d'édition WYSIWYG est conservé tel quel.
- [05 — comrak pour le parsing](05-comrak-pour-le-parsing.md) — pourquoi [comrak](../01-decouverte/glossaire.md#comrak) parse le Markdown côté backend.
- [06 — Snabbdom pour le rendu](06-snabbdom-pour-le-rendu.md) — pourquoi un Virtual DOM dans Muya.
- [07 — Vite et Biome](07-vite-et-biome.md) — pourquoi cet outillage frontend.

## Ordre de lecture conseillé

Si tu découvres MiraMD, lis les ADRs dans cet ordre — chacun s'appuie sur les précédents :

1. **[01 — Tauri vs Electron](01-tauri-vs-electron.md)** pose la fondation : l'app desktop n'embarque pas de navigateur.
2. **[03 — Rust pour le backend](03-rust-pour-le-backend.md)** explique le corollaire : sans Node.js, le backend doit être natif.
3. **[02 — Svelte vs Vue/React](02-svelte-vs-vue-react.md)** explique le choix du framework UI compatible avec un footprint léger.
4. **[04 — Muya conservé](04-muya-conserve.md)** explique pourquoi le moteur d'édition de MarkText a été préservé plutôt que remplacé.
5. **[05 — comrak pour le parsing](05-comrak-pour-le-parsing.md)** explique le parser Markdown côté backend.
6. **[06 — Snabbdom pour le rendu](06-snabbdom-pour-le-rendu.md)** explique le Virtual DOM interne à Muya.
7. **[07 — Vite et Biome](07-vite-et-biome.md)** explique l'outillage de build et de qualité de code.

Si un terme te paraît obscur, le [glossaire](../01-decouverte/glossaire.md) est à un clic.
