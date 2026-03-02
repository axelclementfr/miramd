# Sortir de Muya — Analyse décisionnelle

## Contexte

Muya est l'éditeur WYSIWYG Markdown hérité de MarkText. Il est actuellement intégré comme **bundle pré-compilé** dans `static/muya/` (~2.5 MB de JS/CSS non versionné). MiraMD l'utilise via un wrapper singleton (`src/lib/services/muya.ts`) qui expose ~15 méthodes.

---

## Arguments POUR sortir de Muya

### 1. Dette technique majeure
- **Code non typé** : Muya est du JS vanilla sans types — le wrapper `muya.ts` est truffé de `any` impossibles à éliminer
- **`eval()` en runtime** : Muya utilise `eval()` pour le rendu des code blocks, ce qui force `unsafe-eval` dans la CSP — un compromis de sécurité permanent
- **Pas de maintenance upstream** : MarkText/Muya est abandonné depuis 2023, aucune mise à jour de sécurité
- **Bundle opaque** : fichiers pré-compilés non versionnés, impossibles à patcher sans rebuilder depuis les sources

### 2. Limitations fonctionnelles
- **Pas de collaboration** : Muya ne supporte pas CRDT/OT, bloquant tout futur mode collaboratif
- **Rendu limité** : certaines extensions Markdown (GFM complet, directives, wikilinks) ne sont pas supportées nativement
- **Performance sur gros fichiers** : le DOM complet est reconstruit à chaque changement, pas de virtualisation du document
- **Pas de LSP/autocomplete** : intégration avec des outils externes impossible

### 3. Qualité du projet
- **14 des `any` restants** dans le codebase viennent de Muya
- **Tests impossibles** : Muya nécessite un DOM complet (jsdom insuffisant), rendant les tests unitaires de l'éditeur très difficiles
- **Poids du bundle** : ~2.5 MB de JS statique dans le repo

---

## Arguments CONTRE sortir de Muya (garder Muya)

### 1. Ça fonctionne
- L'éditeur WYSIWYG est **stable et fonctionnel** — aucun bug bloquant remonté
- Les 6 modes d'édition (WYSIWYG, source, split, read-only, focus, typewriter) sont tous opérationnels
- Le rendu Markdown est fidèle et couvre les cas d'usage courants

### 2. Coût de migration extrême
- **Réécrire l'éditeur WYSIWYG = des mois de travail** — c'est le composant le plus complexe de l'app
- Le wrapper `muya.ts` (222 lignes) encapsule bien la complexité — le couplage est contenu
- **Risque de régression élevé** : chaque alternative a ses propres bugs et limitations
- Les alternatives matures (ProseMirror, TipTap, CodeMirror) ont leur propre courbe d'apprentissage

### 3. Priorités
- MiraMD vise une **release beta** — changer d'éditeur reporte cette échéance de plusieurs mois
- Les utilisateurs ne voient pas Muya — ils voient un éditeur Markdown qui fonctionne
- L'énergie serait mieux investie dans des features utilisateur (plugins, export PDF, etc.)

---

## Alternatives possibles

| Éditeur | Type | Avantages | Inconvénients |
|---------|------|-----------|---------------|
| **Milkdown** | ProseMirror-based | Plugin system, TypeScript natif, headless | Moins mature, communauté plus petite |
| **TipTap** | ProseMirror-based | Très populaire, extensible, bonne doc | Lourd (~500 KB), modèle payant pour certaines features |
| **CodeMirror 6** | Code editor | Ultra-performant, TypeScript, virtualisation | Pas WYSIWYG natif (mode source seulement) |
| **Lexical** (Meta) | Framework éditeur | Léger, performant, React/vanilla | Jeune, Markdown pas natif |
| **Custom ProseMirror** | Low-level | Contrôle total, léger | Effort de développement massif |

---

## Recommandation

### Court terme (v0.x → v1.0) : **Garder Muya**
- Le wrapper `muya.ts` isole bien la dépendance
- L'interface `MuyaInstance` (à créer dans cette phase) réduira les `any`
- Documenter `unsafe-eval` et les limitations connues

### Moyen terme (v1.x) : **Préparer la sortie**
- Définir une **interface `EditorAdapter`** abstraite (init, getMarkdown, setMarkdown, undo, redo, onChange, onSelectionChange, destroy)
- Implémenter un **proof-of-concept Milkdown** ou **TipTap** derrière cette interface
- Mesurer les régressions fonctionnelles et de performance

### Long terme (v2.0) : **Migrer**
- Remplacer Muya par l'alternative validée
- Supprimer `static/muya/` et `unsafe-eval` de la CSP
- Bénéficier de types natifs, tests unitaires, et extensibilité

---

## Décision en attente

> **Statut : Muya reste en place pour la v1.0.**
> La migration est un chantier v2.0 à planifier après la release beta.
> En attendant, l'interface `MuyaInstance` et le pattern adapter préparent le terrain.
