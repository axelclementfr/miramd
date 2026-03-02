# 03 — Rust pour le backend

**Date** : 2026-04-29 (décision prise au démarrage de la réécriture, formalisée a posteriori)
**Statut** : adopté

## Contexte

Le choix de [Tauri](../01-decouverte/glossaire.md#tauri) (voir [ADR 01](01-tauri-vs-electron.md)) impose en pratique le langage du [backend](../01-decouverte/glossaire.md#backend) : Tauri est écrit en [Rust](../01-decouverte/glossaire.md#rust) et c'est en Rust que tu écris les commandes [IPC](../01-decouverte/glossaire.md#ipc) que la [WebView](../01-decouverte/glossaire.md#webview) appellera. Mais cet ADR existe pour expliquer **pourquoi on n'a pas cherché à contourner ce choix** — par exemple en utilisant un autre framework qui offrirait une expérience similaire à Tauri avec un autre langage.

Les contraintes étaient :
- **Pas de Node.js dans le runtime final.** L'objectif "footprint léger" tombe si on ré-embarque Node.js à côté de la WebView.
- **Sûreté mémoire** : MarkText avait des fuites de cache documentées (Muya retient des images, des highlights, des diagrammes Mermaid sans politique d'éviction). Un langage avec garbage collector aurait pu masquer ces fuites mais ne les aurait pas éliminées.
- **Performances de parsing** : le [parser](../01-decouverte/glossaire.md#parser) Markdown est l'un des deux hot paths de l'app (avec l'I/O fichier). Un langage compilé est nécessaire pour les performances visées.
- **Écosystème natif** : il fallait des bibliothèques matures pour le système de fichiers, l'observation de fichiers (chokidar côté JS, `notify` côté Rust), le parsing Markdown, la sérialisation JSON.

## Options évaluées

- **Option A — Rust via Tauri** : c'est la voie nominale. Avantages : sûreté mémoire garantie au [compile-time](../01-decouverte/glossaire.md#compilation), performances natives, intégration parfaite avec Tauri (commandes typées via [Serde](../01-decouverte/glossaire.md#serde)), écosystème mature pour nos besoins ([comrak](../01-decouverte/glossaire.md#comrak) pour Markdown, `dirs` pour les chemins XDG, `notify` pour le watch fichier). Inconvénients : courbe d'apprentissage raide (ownership, lifetimes, types `Result`), [Cargo](../01-decouverte/glossaire.md#cargo) compile lentement à froid, peu de contributeurs Markdown editor connaissent Rust.
- **Option B — Go via Wails** : Wails est l'équivalent Tauri pour Go. Avantages : Go est plus simple à apprendre que Rust, écosystème serveur très riche, compilation rapide. Inconvénients : Go embarque un garbage collector — légèrement plus de RAM qu'un binaire Rust, pauses GC potentielles dans les chemins critiques, parser Markdown moins complet (pas d'équivalent comrak avec footnotes + math + superscript). Wails est aussi plus jeune et moins fourni que Tauri en plugins desktop.
- **Option C — C++ via Qt** : alternative classique pour les apps desktop. Avantages : maturité absolue, performances inégalées, énorme bibliothèque de widgets. Inconvénients : licence Qt (LGPL acceptable pour open source mais commerciale-payante au-delà), pas de WebView de l'OS — Qt embarque QtWebEngine basé sur Chromium, donc on revient à un footprint Electron-like, sécurité mémoire non garantie (sauf à se discipliner manuellement avec smart pointers et `std::move`).
- **Option D — Node.js via Electron** : déjà rejeté pour les raisons de l'[ADR 01](01-tauri-vs-electron.md). Listé pour mémoire.

## Décision

**Rust, via Tauri.** Le choix Tauri détermine le langage en pratique, mais on aurait pu choisir un autre framework si Rust avait été un bloqueur réel. La balance a penché vers Rust pour quatre raisons :

1. **Sûreté mémoire au compile-time.** Le compilateur Rust refuse de compiler un programme qui pourrait avoir un use-after-free, une double libération, ou une race condition. Concrètement, ça veut dire qu'on ne déploie pas un éditeur qui crashe sur un fichier piégé à cause d'une erreur d'allocation.
2. **Performances natives.** Pas de garbage collector, pas d'interpréteur, pas de bridge IPC lent. comrak parse 10 à 100 fois plus vite que marked.js (le parser de MarkText) sur les mêmes fichiers.
3. **Écosystème pile-à-poil pour notre cas** : comrak (Markdown GFM complet), `dirs` (chemins XDG), `notify` (watch fichiers), `serde` (JSON), `thiserror` (erreurs typées), `tokio` si on a besoin d'asynchrone (pas encore le cas).
4. **Intégration native avec Tauri** : les commandes IPC sont des fonctions Rust annotées `#[tauri::command]`. La sérialisation JSON est gérée par Serde sans configuration. Le typage est cohérent côté Rust et côté frontend (via les codegen TS de Tauri).

Pédagogiquement : Rust force le développeur à expliciter qui possède une donnée, qui peut la lire, qui peut la modifier. C'est plus contraignant qu'en JavaScript, mais le compilateur attrape au build des bugs qui sinon n'apparaîtraient qu'en production.

Décision adoptée a posteriori. Au moment du switch vers Tauri, l'équipe a accepté Rust comme paquet, sans matrice formelle. Le présent ADR rationalise ce choix avec le recul.

## Conséquences

**Positives :**
- **Aucun `unsafe` dans le code MiraMD.** Tout le code Rust est en Rust safe, ce qui élimine par construction toute une catégorie de failles.
- **Performances** : parsing Markdown sub-milliseconde sur des fichiers de quelques centaines de Ko, écriture fichier instantanée.
- **Erreurs typées** : `AppError` enum avec 6 variantes, propagation via `?`, sérialisation cohérente vers le frontend.
- **CI rapide** : les 28 tests Rust tournent en quelques secondes.
- **Pas de fuite de mémoire silencieuse** : la consommation RAM de MiraMD reste stable même après plusieurs heures d'utilisation (vs MarkText qui dérive sur des longues sessions).

**Négatives (la dette qu'on assume) :**
- **Courbe d'apprentissage raide.** Un nouveau contributeur qui n'a jamais touché à Rust mettra plusieurs semaines à être à l'aise (ownership, lifetimes, traits, `Result<T, E>`, async). C'est une barrière d'entrée réelle pour un projet open source.
- **Builds plus longs.** Un build Rust à froid (CI ou première compilation locale) prend plusieurs minutes. Un build incrémental est plus rapide mais reste plus lent qu'un build Node.
- **Bibliothèques moins fournies dans certains domaines.** Pour le parsing Markdown, c'est mieux qu'en Node ; pour l'orchestration desktop, c'est moins riche.
- **Dette d'apprentissage pour les contributeurs.** Le projet doit fournir une bonne documentation Rust pour ne pas décourager les contributions. Le dossier `02-fondamentaux/` essaie de remplir ce rôle.
- **I/O synchrone actuellement** : `read_file`, `write_file`, `create_file`, `list_directory_entries` sont synchrones. Acceptable pour un éditeur (les fichiers Markdown sont petits), mais un fichier de 50 Mo ou un dossier de 10 000 fichiers bloquera l'event loop Tauri. Migration vers `tokio` à envisager si le besoin se présente.

## Pour aller plus loin

- [Vue d'ensemble de l'architecture](../04-architecture/vue-densemble.md) — la place du backend Rust dans la couche 3.
- [01 — Tauri vs Electron](01-tauri-vs-electron.md) — décision parente de celle-ci.
- [05 — comrak pour le parsing](05-comrak-pour-le-parsing.md) — la bibliothèque Rust qui parse le Markdown.
- [Compilation vs interprétation](../02-fondamentaux/compilation-vs-interpretation.md) — pourquoi Rust est compilé.
- [Glossaire — Rust](../01-decouverte/glossaire.md#rust), [Cargo](../01-decouverte/glossaire.md#cargo), [Serde](../01-decouverte/glossaire.md#serde).
- Audit, section 1 (Architecture) et section 2 (Sécurité) dans [`06-references/audit.md`](../06-references/audit.md).
