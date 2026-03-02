# 01 — Tauri 2 plutôt qu'Electron

**Date** : 2026-04-29 (décision prise au démarrage de la réécriture, formalisée a posteriori)
**Statut** : adopté

## Contexte

MiraMD est une réécriture de MarkText. MarkText reposait sur [Electron](../01-decouverte/glossaire.md#electron) 18, dans une version qui a atteint sa fin de vie en décembre 2022. Trois problèmes structurels motivaient un changement de [runtime](../01-decouverte/glossaire.md#runtime) :

- **Footprint** : un binaire MarkText pèse environ 200 Mo et consomme 200 à 400 Mo de RAM au repos, parce qu'Electron embarque Chromium et Node.js. Pour un éditeur Markdown qui tient en quelques dizaines de milliers de lignes, c'est disproportionné.
- **Sécurité** : la configuration de MarkText cumulait `contextIsolation: false`, `nodeIntegration: true` et `webSecurity: false`. Concrètement, toute injection de contenu malveillant dans la WebView (un fichier `.md` piégé, un copier-coller HTML) avait un accès direct à `require('fs')` et au reste de Node.js — autrement dit, à toute la machine de l'utilisateur. Ce n'est pas un défaut d'Electron en soi, mais l'écosystème encourage encore des configurations laxistes par défaut.
- **Maintenance** : Electron 18 EOL signifie plus de patchs Chromium pour les failles connues. Pour un projet qui ouvre des fichiers fournis par l'utilisateur, la maintenance du moteur de rendu est un sujet permanent.

Il fallait donc choisir un nouveau runtime [desktop](../01-decouverte/glossaire.md#application-desktop) capable de héberger une [WebView](../01-decouverte/glossaire.md#webview) pour le rendu et un backend pour les opérations système.

## Options évaluées

- **Option A — Continuer sous Electron** (modernisé) : on aurait gardé Electron en passant à la dernière version, en activant `contextIsolation: true` et en migrant les usages `nodeIntegration` vers des `contextBridge`. Avantages : écosystème mature, beaucoup d'exemples, équipe de développement potentiellement déjà à l'aise. Inconvénients : le footprint Chromium reste incompressible (~150 Mo de binaire minimum), la mise à niveau d'Electron casse régulièrement les API natives, l'ergonomie sécurité reste opt-in.
- **Option B — [Tauri](../01-decouverte/glossaire.md#tauri) 2** : framework qui s'appuie sur la WebView native de l'OS (WebKitGTK sur Linux, WKWebView sur macOS, WebView2 sur Windows) et un binaire [Rust](../01-decouverte/glossaire.md#rust) pour le backend. Avantages : binaire ~5 Mo, RAM ~30 Mo, [sandbox](../01-decouverte/glossaire.md#sandbox) stricte par défaut, [capabilities](../01-decouverte/glossaire.md#capability-tauri) explicites, communication [IPC](../01-decouverte/glossaire.md#ipc) typée via [Serde](../01-decouverte/glossaire.md#serde). Inconvénients : il faut écrire du Rust, l'écosystème de plugins est plus restreint qu'Electron, et la WebView change d'un OS à l'autre — donc certains comportements diffèrent (notamment WebKitGTK qui ne gère pas Ctrl+Z dans les `contenteditable` comme Chromium le fait).
- **Option C — Wails (Go)** : équivalent de Tauri avec Go côté backend. Avantages : écosystème Go riche pour le système de fichiers et le réseau, courbe d'apprentissage plus douce que Rust. Inconvénients : Go embarque un garbage collector (peu pertinent ici mais légèrement plus de RAM qu'un binaire Rust), parser Markdown moins mature que [comrak](../01-decouverte/glossaire.md#comrak), écosystème de plugins desktop plus limité que Tauri.
- **Option D — NW.js** : alternative historique à Electron, même principe (Chromium + Node embarqués). Mêmes problèmes de footprint et de sécurité. Aucun avantage net en 2025.
- **Option E — Neutralino** : ultra-léger, utilise la WebView OS et un binaire C++. Avantages : footprint minuscule. Inconvénients : très peu mature, écosystème quasi inexistant, pas d'IPC structuré, sécurité non documentée.

## Décision

**Tauri 2.** Le projet répond aux trois reproches faits à Electron simultanément : footprint divisé par 30 ou 40, sandbox stricte par défaut, écosystème suffisamment mature en 2025 pour publier des binaires multi-OS via le bundler officiel.

Pédagogiquement : Tauri inverse la philosophie d'Electron. Plutôt que d'embarquer un navigateur complet et de **demander au développeur de fermer les portes**, il fournit un environnement minimal et **ouvre les portes au cas par cas** via les capabilities. Pour un éditeur qui charge des fichiers utilisateur, c'est la posture saine.

Décision adoptée à un moment où Tauri 2 venait de stabiliser son API. La version 1 aurait été plus risquée. Le choix n'a pas fait l'objet d'un comparatif formel écrit à l'époque ; il a été motivé par les retours communautaires et les benchmarks publics du projet Tauri.

## Conséquences

**Positives :**
- Footprint passé de 200 Mo à environ 5 Mo (binaire) et de 300 Mo à environ 30 Mo (RAM au repos).
- Démarrage à froid sous 100 ms (vs 2 à 5 secondes pour MarkText).
- Modèle de sécurité explicite : la WebView ne peut rien faire que les capabilities ne lui autorisent. Pas de risque que `nodeIntegration` traîne par accident.
- La [CSP](../01-decouverte/glossaire.md#csp) déclarée dans `tauri.conf.json` est appliquée par la WebView, ce qui ajoute une couche de défense contre les injections.
- Mises à jour de la WebView gérées par l'OS — moins de surface de maintenance pour le projet.

**Négatives (la dette qu'on assume) :**
- Le backend est en Rust. Pour un contributeur qui vient de Node.js, la courbe d'apprentissage est réelle (ownership, lifetimes, types `Result`).
- L'écosystème Tauri est plus petit qu'Electron : moins de plugins prêts à l'emploi (par exemple, pas d'équivalent direct à `electron-store` au moment du choix — on a écrit notre propre persistance Serde + JSON).
- **Comportement de la WebView varie selon l'OS.** WebKitGTK sur Linux ne supporte pas certains comportements `contenteditable` natifs (notamment Ctrl+Z) — d'où l'interception clavier custom dans `MuyaPane.svelte`. C'est une source de bugs subtils.
- Builds plus longs (Rust compile à froid en plusieurs minutes).
- Auto-update : Tauri propose un système, mais il n'est pas activé dans MiraMD à ce stade. À planifier.
- Signing des binaires : pas encore automatisé en CI. À chaque release, il faut le faire à la main (ou pas du tout selon l'OS).

## Pour aller plus loin

- [Vue d'ensemble de l'architecture](../04-architecture/vue-densemble.md) — comment Tauri s'insère dans les trois couches.
- [03 — Rust pour le backend](03-rust-pour-le-backend.md) — corollaire direct de ce choix.
- [Glossaire — Tauri](../01-decouverte/glossaire.md#tauri), [WebView](../01-decouverte/glossaire.md#webview), [Electron](../01-decouverte/glossaire.md#electron).
- Audit complet : section 7 (Frontend / Tauri) et section 9 (Deployment / Ops) dans [`06-references/audit.md`](../06-references/audit.md).
