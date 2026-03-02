# Stack technique — Pourquoi ces choix ?

Ce document explique et justifie chaque choix technique de MiraMD par rapport aux alternatives.

---

## Runtime : Tauri 2 (vs Electron)

| Critère | Electron | Tauri 2 |
|---|---|---|
| RAM au repos | ~200-400 MB (embarque Chromium) | ~20-50 MB (WebView native OS) |
| Taille binaire | ~150-250 MB | ~5-15 MB |
| Sécurité | Renderer a accès Node.js si mal configuré | Sandboxé par défaut, permissions explicites |
| Startup | ~2-5s | <1s |
| IPC | Événements nommés, non typés | Commandes typées (serde), compile-time safe |
| Maintenance | Chromium à maintenir/mettre à jour | WebView OS gérée par le système |

**Pourquoi Tauri :** MarkText souffrait de `contextIsolation: false` + `nodeIntegration: true` — toute XSS devenait une RCE. Tauri élimine cette catégorie de vulnérabilité par design. Le gain en RAM et taille binaire est un bonus majeur.

**Pourquoi pas Electron modernisé :** Même avec les bonnes pratiques, Electron embarque toujours Chromium (~150 MB). Pour un éditeur de texte, c'est disproportionné.

---

## Backend : Rust

| Critère | Node.js (MarkText) | Rust (MiraMD) |
|---|---|---|
| Parsing markdown | marked.js ~1x | comrak ~10-100x plus rapide |
| File I/O | Async mais bridge IPC lent | Natif, zero-copy possible |
| Memory safety | GC avec fuites possibles | Garanti à la compilation |
| Sérialisation | JSON.parse/stringify | serde (zero-allocation possible) |
| Concurrence | Event loop mono-thread | Multi-thread natif (tokio si besoin) |

**Pourquoi Rust :** Le parsing Markdown et les opérations fichiers sont les deux hot paths de l'app. Rust les exécute nativement, sans overhead GC ni bridge IPC lent. La safety mémoire élimine les fuites (caches non bornés dans Muya).

**Pourquoi pas Go/Zig :** Go a un GC (pas idéal pour un desktop app). Zig n'a pas l'écosystème (pas de parser markdown mature). Rust est le sweet spot : performances C, safety garantie, écosystème riche (comrak, serde, notify, dirs).

---

## Parser Markdown : comrak (vs marked.js, pulldown-cmark)

| Critère | marked.js | pulldown-cmark | comrak |
|---|---|---|---|
| Langage | JavaScript | Rust | Rust |
| GFM complet | Partiel | Basique | Complet |
| Footnotes | Non | Non | Oui |
| Math | Non | Non | Oui (math_dollars, math_code) |
| Superscript | Non | Non | Oui |
| Description lists | Non | Non | Oui |
| Utilisé par | MarkText | mdBook | GitHub.com |

**Pourquoi comrak :** C'est le parser utilisé par GitHub en production. Il supporte toutes les extensions GFM + footnotes + math + superscript nativement. pulldown-cmark est plus rapide en micro-benchmarks mais manque trop d'extensions.

---

## Frontend : Svelte 5 (vs Vue 3, React, SolidJS)

| Critère | Vue 2 (MarkText) | Vue 3 | React | Svelte 5 |
|---|---|---|---|---|
| Bundle runtime | ~22 KB | ~33 KB | ~42 KB | ~2 KB (compilé) |
| Virtual DOM | Oui | Oui | Oui | Non (mise à jour chirurgicale) |
| State management | Vuex (externe) | Pinia (externe) | Redux/Zustand | Stores natifs intégrés |
| Syntaxe | SFC | SFC | JSX | Proche du HTML natif |
| TypeScript | Partiel | Bon | Bon | Excellent |
| Scaffold Tauri | Non officiel | Supporté | Supporté | Officiel |

**Pourquoi Svelte :** Zéro runtime — Svelte compile les composants en JavaScript vanilla qui manipule le DOM directement. Pour une app desktop où chaque KB de bundle et chaque ms de rendu comptent, c'est optimal. Les stores réactifs natifs éliminent le besoin de Pinia/Redux.

**Pourquoi pas Vue 3 :** Vue 3 est excellent mais embarque un Virtual DOM (~33 KB de runtime). Pour une app Tauri qui vise la légèreté, Svelte est plus cohérent avec la philosophie.

**Pourquoi pas React :** Bundle plus gros, JSX plus verbeux, nécessite un state manager externe.

**Pourquoi pas SolidJS :** Excellentes performances (similaires à Svelte) mais écosystème plus petit et moins de support tooling/IDE.

---

## Éditeur : TipTap 3 / ProseMirror (vs Muya, CodeMirror 6)

| Critère | Muya (MarkText) | CodeMirror 6 | TipTap / ProseMirror |
|---|---|---|---|
| Type | Custom (~15K lignes) | Code editor | Rich text editor |
| Architecture | Mixins prototype (28) | Extensions | Extensions modulaires |
| WYSIWYG Markdown | Oui (custom) | Plugin (partiel) | Natif (tiptap-markdown) |
| Tables | Custom | Basique | Extension officielle |
| Task lists | Custom | Non | Extension officielle |
| Drag & drop | Custom | Limité | Natif ProseMirror |
| Headless | Non | Oui | Oui (contrôle total du style) |
| Maintenance | 1 mainteneur | Marijn Haverbeke | Grande communauté active |
| Tests | Minimaux | Complets | Complets |

**Pourquoi TipTap :** Il est construit sur ProseMirror — le moteur d'édition rich-text le plus robuste et le mieux testé qui existe. TipTap ajoute une API moderne, un système d'extensions propre, et le support Markdown natif via `tiptap-markdown`. On récupère ~90% des fonctionnalités de Muya sans écrire une seule ligne de moteur éditeur.

**Pourquoi pas réécrire Muya :** 15 000+ lignes de code spécialisé, 28 controllers, un parser custom, un rendu Snabbdom. Le réécrire prendrait des mois et produirait un résultat moins testé que ProseMirror (qui a 10+ ans de battle-testing).

**Pourquoi pas CodeMirror 6 :** CodeMirror est optimisé pour l'édition de code, pas pour l'édition rich-text/WYSIWYG. Le mode Markdown de CodeMirror montre la syntaxe brute, pas un rendu riche.

---

## State management : Svelte stores natifs (vs Vuex, Pinia, Redux)

**Pourquoi les stores natifs :** Svelte intègre un système de stores réactifs (`writable`, `derived`) qui suffit largement pour notre cas. Ajouter Pinia ou Redux sur Svelte serait de l'over-engineering — on a ~5 stores (editor, preferences, theme) pas 50.

---

## Résumé de la stack

```
┌──────────────────────────────────────────┐
│           MiraMD — Stack                  │
├──────────────┬───────────────────────────┤
│ Runtime      │ Tauri 2                   │
│ Backend      │ Rust                      │
│ Parser MD    │ comrak (Rust)             │
│ Frontend     │ Svelte 5 + TypeScript     │
│ Éditeur      │ TipTap 3 (ProseMirror)   │
│ Syntax HL    │ lowlight (highlight.js)   │
│ State        │ Svelte stores natifs      │
│ Build        │ Vite + Cargo              │
│ Packaging    │ Tauri bundler             │
│ Preferences  │ serde + JSON (Rust)       │
└──────────────┴───────────────────────────┘
```
