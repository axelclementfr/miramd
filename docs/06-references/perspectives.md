# Perspectives long terme

> Ce document fusionne et remplace `vision_longterme.md`. Il décrit où MiraMD pourrait aller à 1+ an, en restant honnête : ce sont des **pistes prospectives**, pas des promesses. Certaines seront probablement abandonnées, d'autres mûriront en [ADR](../01-decouverte/glossaire.md#adr).
>
> Pour ce qui est planifié à court ou moyen terme, voir [`feuille-de-route.md`](feuille-de-route.md).

---

## Vision

MiraMD est aujourd'hui un éditeur Markdown desktop minimal, construit sur [Tauri](../01-decouverte/glossaire.md#tauri) 2 et [Svelte](../01-decouverte/glossaire.md#svelte) 5, qui réutilise [Muya](../01-decouverte/glossaire.md#muya) pour le moteur d'édition [WYSIWYG](../01-decouverte/glossaire.md#wysiwyg). C'est un remplaçant direct de [MarkText](https://github.com/marktext/marktext), avec une empreinte ~10× plus faible et une surface d'attaque drastiquement réduite.

À long terme, la question est : **MiraMD reste-t-il un simple éditeur, ou devient-il une plateforme** ?

Trois directions possibles, non exclusives :

1. **Éditeur stable et minimal** — on reste sur le scope actuel, on fiabilise, on optimise. Pas d'ajout de features qui ne serviraient pas l'édition Markdown au quotidien. C'est la trajectoire conservatrice.
2. **Éditeur extensible** — on ajoute un système de plugins tiers, une [API](../01-decouverte/glossaire.md#api) publique, des hooks documentés. MiraMD devient une base sur laquelle d'autres construisent.
3. **Plateforme d'écriture** — on intègre la sync multi-machines, l'édition collaborative, les notes liées (à la Obsidian), les exports avancés. MiraMD ne se contente plus d'éditer un fichier, il gère un corpus.

Aucune de ces directions n'est tranchée à ce jour. Ce document explore les pistes de la 2e et de la 3e en restant prudent sur leur faisabilité.

---

## Pistes long terme (1+ an)

### Remplacement éventuel de Muya

C'est la piste la plus discutée et la plus controversée. Muya est un moteur [WYSIWYG](../01-decouverte/glossaire.md#wysiwyg) hérité de MarkText (~100k lignes de JavaScript pré-compilé, non typé), construit sur l'API navigateur `contenteditable`. Il fonctionne mais il a des limites bien documentées :

- Comportement imprévisible cross-browser (notamment [WebKitGTK](../01-decouverte/glossaire.md#webkitgtk) sur Linux).
- Performance qui plafonne sur des fichiers de plusieurs dizaines de milliers de lignes.
- Gestion de l'IME (saisie CJK, accents morts, dictée) fragile.
- Nécessite `unsafe-eval` dans la [CSP](../01-decouverte/glossaire.md#csp), ce qui apparaît comme dette technique cosmétique.
- Maintenance upstream à l'arrêt — chaque fix doit être rapatrié manuellement dans le code [vendored](../01-decouverte/glossaire.md#muya).

Une **alternative théoriquement optimale** serait un moteur écrit en [Rust](../01-decouverte/glossaire.md#rust), compilé en [WASM](../01-decouverte/glossaire.md), qui dessine sur un `<canvas>` HTML plutôt que dans le DOM. C'est l'approche choisie par Monaco, Zed, Lapce et Google Docs (qui a migré en 2021).

#### Pourquoi cette piste n'est probablement pas la bonne pour MiraMD

Le calcul coût/bénéfice est défavorable :

| | Migration Rust/WASM | Stabilisation Muya |
|---|---|---|
| **Effort** | Plusieurs mois intensifs | Quelques semaines |
| **Risque** | Élevé (IME, accessibilité, régressions) | Faible (corrections ciblées) |
| **Gain utilisateur visible** | Quasi nul à court terme | Bugs corrigés, expérience fluide |
| **Gain technique** | Types, tests, plus de `eval()` | Muya isolé, wrapper compact |

Réécrire un éditeur WYSIWYG complet (headings, listes, tableaux, code blocks, toolbar, auto-pairing, IME, accessibilité, modes d'édition) pour obtenir un résultat visuellement identique à l'actuel relève de l'over-engineering. Le `unsafe-eval` est un compromis qui paraît pire qu'il ne l'est : la [WebView](../01-decouverte/glossaire.md#webview) Tauri est sandboxée par design, ce que Muya peut faire dedans est fortement limité.

**Conclusion provisoire** : Muya reste, on stabilise. Si un jour Muya devenait un vrai blocage (vulnérabilité sans contournement, bug structurel non fixable), cette piste reste documentée comme alternative possible.

#### Référence pour un futur ADR

Si la décision était reprise, elle mériterait un ADR formel listant :

- Le déclencheur précis (quel bug, quelle vulnérabilité, quelle limite a forcé la main).
- Les options envisagées (réécriture from scratch, fork de Muya, adoption de ProseMirror/TipTap/Lexical, moteur Rust/WASM custom).
- Le coût estimé en mois-personne et le risque de régression.
- La stratégie de migration progressive (mode source d'abord, WYSIWYG ensuite ?).

---

### Plugins tiers

À ce jour, MiraMD n'a pas de système d'extension. Ajouter du comportement custom suppose de modifier le code source et de recompiler. C'est cohérent avec une approche minimaliste, mais ça plafonne ce que peuvent faire les utilisateurs avancés.

Pistes à étudier (sans engagement) :

- **Plugins frontend en JavaScript** chargés à l'exécution. Le plus simple à implémenter, le plus risqué côté sécurité — il faudrait isoler chaque plugin (worker dédié ? iframe sandboxée ?).
- **Plugins backend en WebAssembly**. Plus sûr (sandbox WASM native), plus lourd à mettre en œuvre. Permet de faire tourner du code Rust, Go, AssemblyScript de manière contrôlée.
- **API d'export uniquement** (pas de modification de l'éditeur, juste pouvoir transformer un document). Approche prudente qui couvrirait probablement 80% des besoins (export PDF custom, conversion vers d'autres formats, intégrations avec outils externes).

Pré-requis non négociables avant d'ouvrir cette voie :

- Une API [Muya](../01-decouverte/glossaire.md#muya) publique stable (à ce jour, le wrapper `MuyaService` est privé et changeant).
- Un mécanisme de permission explicite (un plugin qui veut lire des fichiers doit demander, l'utilisateur accorde).
- Un store de plugins ou au moins un manifest signé pour éviter le supply-chain attack.

#### Référence pour un futur ADR

Le choix entre plugins JS, WASM, ou API d'export uniquement mériterait un ADR. Question structurante : "qui est le public cible des plugins ?" — un développeur pourra toujours forker. Un utilisateur normal voudra installer en un clic. Les deux populations n'ont pas les mêmes besoins.

---

### Sync multi-machines

Idée : synchroniser les fichiers d'un workspace MiraMD entre plusieurs machines (poste fixe + portable + tablette).

Problème immédiat : **MiraMD est un éditeur de fichiers locaux**, pas un service. Ajouter de la sync demanderait :

- Soit un service backend hébergé par le projet (gros engagement opérationnel et juridique — RGPD, hébergement, paiement, support).
- Soit une intégration avec des services existants (Dropbox, Google Drive, Nextcloud, iCloud) — délicat sur Linux où les SDK sont incomplets.
- Soit un protocole pair-à-pair ([CRDT](../01-decouverte/glossaire.md) sur libp2p ou similaire) — techniquement intéressant, opérationnellement complexe.

À ce jour, l'utilisateur peut déjà mettre son workspace dans un dossier synchronisé par un outil tiers (Syncthing, Dropbox, Git). Ça marche, c'est suffisant pour la plupart des cas.

**Conclusion provisoire** : pas une priorité. Si la demande vient, étudier d'abord une intégration légère avec Syncthing ou Git plutôt qu'un service propriétaire.

---

### Édition collaborative

Idée : plusieurs utilisateurs éditant le même document en temps réel, à la Google Docs ou HackMD.

C'est techniquement faisable avec un [CRDT](../01-decouverte/glossaire.md) (Yjs, Automerge) et un transport WebSocket. Mais ça change profondément le scope de l'application :

- L'éditeur n'est plus uniquement local-first ; il y a un serveur ou un peer.
- Les conflits de Muya (curseurs, undo/redo) qui sont déjà fragiles en mono-utilisateur le seront davantage en multi.
- La surface d'attaque augmente (auth, autorisation, audit).

À étudier seulement si :

- La demande utilisateur est forte et précise (cas d'usage concret, pas juste "ce serait cool").
- L'éditeur lui-même est devenu stable en mono-utilisateur (pas avant fixe complet d'undo/redo, autoSave, TOC).

---

### Auto-update et signing

Sujets opérationnels qui restent à traiter :

- **Auto-update Tauri** — le plugin existe, il n'est pas configuré. Ajouterait du confort utilisateur, demande un endpoint d'updates et une stratégie de versioning.
- **Signature de code** — actuellement non automatisée, signature manuelle à chaque release. Sur macOS et Windows, c'est requis pour éviter les warnings au lancement. Sur Linux, c'est moins critique mais utile pour les paquets `.deb` et `.AppImage`.

Ces deux sujets sont listés dans la [feuille de route](feuille-de-route.md) sans horizon précis. Ils ne sont pas bloquants tant que les releases restent peu fréquentes.

---

## Idées exploratoires

Sous le format "if we were to..." — des choses qu'on pourrait étudier, sans engagement et sans priorité.

- **Si on intégrait un mode présentation** (à la Marp/reveal.js) : transformer un Markdown en slides directement dans l'éditeur. Demanderait une parser dédié pour `---` comme séparateur et un mode rendu plein écran.
- **Si on supportait les notes liées** (à la Obsidian) : permettre `[[wiki-link]]` avec autocomplétion et graph view. Glisse vers une plateforme de gestion de notes — au-delà du scope éditeur.
- **Si on ajoutait l'export avancé** : PDF avec mise en page personnalisée, EPUB, DOCX. comrak parse vers AST, on pourrait générer ces formats côté Rust. Demande une intégration avec des libs lourdes.
- **Si on supportait les snippets et templates** : un système de raccourcis utilisateur (`!todo` → expanse en `- [ ] `). Petit gain ergonomique, faisable sans grand engagement.
- **Si on intégrait un LSP côté Markdown** : autocomplétion, lint, diagnostics — utile pour les utilisateurs power. Demande un serveur LSP existant ou à écrire.
- **Si on avait un mode mobile / responsive** : MiraMD est aujourd'hui purement desktop. Une version Tauri Mobile (iOS/Android) est techniquement faisable mais demanderait de repenser l'UI complète.

Aucune de ces idées n'est sur la feuille de route. Elles sont là pour servir de point de départ si la communauté ou un contributeur veut creuser.

---

## Liens vers ADRs futurs possibles

Les sujets ci-dessous mériteraient un [ADR](../01-decouverte/glossaire.md#adr) formel s'ils étaient repris activement. À ce jour, aucun n'a été tranché.

- **`adr-future-muya-replacement.md`** — décision sur le sort de Muya à long terme.
- **`adr-future-plugin-system.md`** — choix de l'architecture de plugins (JS / WASM / API export).
- **`adr-future-sync.md`** — choix d'une stratégie de sync (service maison, intégration tierce, P2P).
- **`adr-future-collaborative.md`** — décision d'introduire ou non l'édition collaborative.
- **`adr-future-auto-update.md`** — configuration du plugin updater Tauri.

Ces fichiers n'existent pas. Ils sont mentionnés ici pour référence : si l'un de ces sujets devient actif, l'ADR correspondant devrait être créé dans [`docs/03-choix-techniques/`](../03-choix-techniques/) avant l'implémentation.

---

## Avertissement final

Ce document est **prospectif**. Rien de ce qui est écrit ici n'est promis. Les pistes décrites peuvent être abandonnées, reformulées, ou priorisées différemment selon ce que la pratique de MiraMD fera émerger.

L'objectif n'est pas d'aligner une feuille de route alternative, mais de **donner un cadre de réflexion** : si tu as une idée à long terme pour le projet, tu peux la situer dans ce document plutôt que de la laisser flotter dans une issue ou une discussion isolée.
