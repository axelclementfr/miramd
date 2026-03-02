# 07 — Vite + Biome pour l'outillage frontend

**Date** : 2026-04-29 (décision prise au démarrage de la réécriture, formalisée a posteriori)
**Statut** : adopté

## Contexte

Le frontend [Svelte](../01-decouverte/glossaire.md#svelte) (voir [ADR 02](02-svelte-vs-vue-react.md)) doit être **bundlé** pour la WebView : le navigateur ne sait pas exécuter directement des fichiers `.svelte` ni des modules TypeScript épars — il faut produire un ensemble de fichiers JavaScript/CSS/HTML qu'il peut charger.

À côté du [bundler](../01-decouverte/glossaire.md#bundler), le projet a besoin d'outils de **qualité de code** : un [linter](../01-decouverte/glossaire.md#linter) pour repérer les erreurs probables et un formateur pour homogénéiser le style. MarkText utilisait ESLint + Prettier, configuration historique mais lente et peu intégrée.

Trois critères orientaient le choix :

- **Vitesse** : un développeur lance le bundler en boucle pendant le développement (à chaque sauvegarde, hot reload). Un bundler lent dégrade fortement la productivité.
- **Compatibilité Tauri** : le bundler doit pouvoir produire un build statique que Tauri sert dans la WebView, sans serveur HTTP en production.
- **Compatibilité Svelte 5** : il faut un plugin ou une intégration qui comprenne les `*.svelte` files et les runes.

## Options évaluées (bundler)

- **Option A — [Vite](../01-decouverte/glossaire.md#vite)** : bundler nouvelle génération basé sur esbuild en dev et Rollup en build. Avantages : démarrage instantané (pas de bundling au démarrage, modules ES servis natifs au navigateur), HMR sub-seconde, plugin Svelte officiel, intégration Tauri standard (`tauri dev`). Inconvénients : a remplacé Webpack tardivement dans certaines parties de l'écosystème — quelques bibliothèques ont des intégrations Webpack-only qui demandent un peu de configuration custom.
- **Option B — Webpack 5** : standard historique du bundling JavaScript. Avantages : énorme écosystème, plugins pour tout, configuration très flexible. Inconvénients : démarrage lent (bundling complet au lancement), HMR plus lent, configuration verbeuse (le `webpack.config.js` peut faire des centaines de lignes), philosophie d'avant l'ère ES modules natifs.
- **Option C — Rollup** : bundler très bon pour les bibliothèques (tree-shaking de pointe). Avantages : sortie très propre, performance correcte. Inconvénients : moins ergonomique pour les apps que pour les libs, dev server moins fourni que Vite (qui utilise Rollup en interne pour le build mais pas pour le dev).
- **Option D — Parcel** : bundler "zéro config". Avantages : démarrage rapide. Inconvénients : moins flexible que Vite, écosystème de plugins plus limité, support Svelte moins suivi.

## Options évaluées (lint + format)

- **Option A — [Biome](../01-decouverte/glossaire.md#biome)** : outil tout-en-un (linter + formateur) écrit en Rust, fork du projet Rome. Avantages : binaire unique, ultra-rapide (10-100× ESLint+Prettier sur les mêmes fichiers), une seule configuration (`biome.json`), supporte JS/TS/JSON. Inconvénients : plus jeune qu'ESLint, donc moins de plugins/règles disponibles (pas tous les checks de `eslint-plugin-svelte` par exemple), support Svelte partiel (Biome lint le code TypeScript dans les fichiers `.svelte` mais pas la syntaxe template).
- **Option B — ESLint + Prettier** : standard historique. Avantages : plugin pour tout (Svelte, Vue, React, accessibility, security...), énorme communauté, règles très fines. Inconvénients : lent (chaque outil parse le code séparément), configuration redondante, deux outils à orchestrer, risque de conflits de règles entre ESLint et Prettier.
- **Option C — Rome** : projet originel dont Biome est le fork. Avantages : aucun (le projet est mort en 2023, repris par les contributeurs sous le nom Biome).
- **Option D — dprint** : formateur Rust très rapide, sans linter. Avantages : très rapide, excellent formateur. Inconvénients : ne fait que le format, il faut un linter à côté.

## Décision

**Vite + Biome.** Les deux choix répondent au critère "rapide pendant le dev", ce qui est la priorité numéro un quand on développe une app desktop avec hot reload. Biome unifie lint et format en un binaire, ce qui simplifie la configuration et accélère le pipeline de qualité (notamment dans les pre-commit hooks et la CI).

Pédagogiquement : Vite et Biome sont tous les deux écrits ou compilés en code natif (esbuild en Go, Biome en Rust). Cette migration des outils Node.js vers des outils natifs est une tendance lourde de l'écosystème frontend post-2023. Pour un projet qui privilégie la vitesse de développement, c'est l'investissement raisonnable.

Décision adoptée a posteriori : pas de matrice de comparaison écrite à l'époque, mais le tooling Tauri 2 utilise Vite par défaut, et Biome a été choisi rapidement comme remplaçant d'ESLint+Prettier dès le scaffold du projet.

Configuration retenue :
- `vite.config.js` : plugin Svelte, plugin Tauri standard (`@tauri-apps/api`).
- `biome.json` : règles "recommended" + quelques ajustements (largeur 100, tabs/espaces selon convention, exclusion `src/lib/muya/**` qui est du code legacy vendored).
- Husky + lint-staged : `biome check --write` sur les fichiers TS/JS modifiés en pre-commit, `cargo fmt --check` sur les fichiers Rust.

## Conséquences

**Positives :**
- **HMR sub-seconde** : modifier un composant Svelte met à jour la WebView Tauri en moins d'une seconde, en gardant l'état de l'app.
- **Démarrage de `npm run tauri dev` rapide** : Vite ne pré-bundle pas, il sert les modules à la demande.
- **Build de prod optimisé** : Rollup en interne assure le tree-shaking et la minification.
- **Lint + format unifiés** : `npm run lint` lance Biome qui fait les deux. Le pipeline CI est plus court (un seul outil à installer et invoquer).
- **Configuration courte** : `biome.json` fait quelques dizaines de lignes (vs un `.eslintrc` + `.prettierrc` qui peuvent atteindre la centaine).
- **Performance pre-commit** : Biome traite tous les fichiers TS/JS en quelques centaines de millisecondes, ce qui rend les hooks Husky non bloquants pour le développeur.

**Négatives (la dette qu'on assume) :**
- **Biome plus jeune qu'ESLint** : moins de règles spécialisées disponibles. Pas d'équivalent direct à `eslint-plugin-jsx-a11y`, `eslint-plugin-import`, `eslint-plugin-security`. Pour des projets soucieux d'accessibilité ou de sécurité fine, c'est une limite.
- **Support Svelte partiel** : Biome lint le code TypeScript à l'intérieur des balises `<script>` des fichiers `.svelte`, mais pas la syntaxe template. Pour les checks template, on s'appuie sur `svelte-check` (compilateur Svelte officiel) en complément.
- **Vite a remplacé Webpack tardivement dans l'industrie** : certaines bibliothèques tierces ont encore des intégrations Webpack-only (loaders, plugins). Le contournement est généralement faisable mais peut demander un plugin Vite custom.
- **Migration vers une nouvelle version Biome possiblement bruyante** : Biome ajoute des règles dans ses majors. Ça peut générer beaucoup d'avertissements à chaque mise à jour, qu'il faut trier (corriger / désactiver).
- **Le binaire Biome doit être installé via npm** (`@biomejs/biome`). Sur des CI très restreintes, le téléchargement peut échouer si on ne whitelist pas le CDN npm. Pas de problème observé à ce jour.

## Pour aller plus loin

- [Vue d'ensemble de l'architecture](../04-architecture/vue-densemble.md) — comment Vite et Tauri s'orchestrent au build et en dev.
- [02 — Svelte vs Vue/React](02-svelte-vs-vue-react.md) — pourquoi le frontend est en Svelte (et donc pourquoi le bundler doit comprendre Svelte).
- [Glossaire — Vite](../01-decouverte/glossaire.md#vite), [Biome](../01-decouverte/glossaire.md#biome), [Bundler](../01-decouverte/glossaire.md#bundler), [Linter](../01-decouverte/glossaire.md#linter).
- Audit, sections 9 (Deployment / CI) et 10 (DX) dans [`06-references/audit.md`](../06-references/audit.md).
- Documentation officielle : [vitejs.dev](https://vitejs.dev) et [biomejs.dev](https://biomejs.dev).
