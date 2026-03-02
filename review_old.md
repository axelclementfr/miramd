# Audit MarkText vs MiraMD — Comparatif fonctionnel exhaustif

**Date** : 2026-03-21
**Objectif** : Identifier tous les écarts entre MarkText et MiraMD pour atteindre la parité fonctionnelle

---

## Légende
- ✅ Implémenté et fonctionnel
- ⚠️ Partiellement implémenté / inférieur à MarkText
- ❌ Non implémenté
- 🔴 Buggé / ne fonctionne pas

---

## 1. FORMATAGE INLINE

| Fonctionnalité | MarkText | MiraMD | Écart |
|---|---|---|---|
| Bold (Ctrl+B) | ✅ | ✅ | — |
| Italic (Ctrl+I) | ✅ | ✅ | — |
| Underline (Ctrl+U) | ✅ | ✅ | — |
| Strikethrough (Ctrl+D) | ✅ | ✅ | — |
| Highlight (Ctrl+Shift+H) | ✅ | ✅ | — |
| Inline Code | ✅ | ✅ | — |
| **Inline Math** ($...$) | ✅ Ctrl+Shift+M, rendu KaTeX inline | ❌ | Pas de rendu inline KaTeX |
| **Superscript** | ✅ `<sup>` | ❌ | |
| **Subscript** | ✅ `<sub>` | ❌ | |
| Links (Ctrl+L/K) | ✅ avec popup d'édition | ⚠️ | Pas de popup d'édition au clic |
| Images | ✅ toolbar + resize handles | ⚠️ | Pas de toolbar image, pas de resize |
| **Clear Formatting** | ✅ Ctrl+Shift+R | ⚠️ | Existe dans bubble toolbar uniquement |

## 2. TYPES DE BLOCS

| Fonctionnalité | MarkText | MiraMD | Écart |
|---|---|---|---|
| Headings H1-H6 | ✅ | ✅ | — |
| Paragraph | ✅ | ✅ | — |
| Bullet Lists | ✅ | ✅ | — |
| Ordered Lists | ✅ | ✅ | — |
| Task Lists | ✅ | ✅ | — |
| Blockquotes | ✅ | ✅ | — |
| Code Blocks | ✅ 100+ langages, picker UI | ✅ 15 langages | Moins de langages, pas de picker |
| Horizontal Rule | ✅ | ✅ | — |
| Tables | ✅ | ✅ | Voir section Tables |
| **Display Math** ($$) | ✅ KaTeX, toggle code/preview | 🔴 | Buggé — ne se comporte pas comme MarkText |
| **HTML Block** | ✅ Preview + toggle code/preview | 🔴 | Buggé |
| **Front Matter** | ✅ YAML/TOML/JSON, position 0 | 🔴 | Buggé |
| **Mermaid** | ✅ SVG preview live | 🔴 | Buggé |
| **Flowchart** | ✅ flowchart.js | 🔴 | Buggé |
| **Sequence Diagram** | ✅ js-sequence | 🔴 | Buggé |
| **PlantUML** | ✅ serveur distant | 🔴 | Buggé |
| **Vega Chart** | ✅ vega-embed | 🔴 | Buggé |
| **Footnotes** [^ref] | ✅ | ❌ | |
| **Loose List Item** toggle | ✅ | ❌ | |
| **Promote/Demote Heading** | ✅ Ctrl++/- | ❌ | |

## 3. TABLES — Comparaison détaillée

| Fonctionnalité | MarkText | MiraMD | Écart |
|---|---|---|---|
| Insérer table | ✅ Grille visuelle 30×20 | ⚠️ 3×3 fixe | Pas de sélecteur de taille |
| Ajouter ligne au-dessus/dessous | ✅ | ⚠️ dessous seulement | |
| Ajouter colonne gauche/droite | ✅ | ⚠️ droite seulement | |
| Supprimer ligne | ✅ | ✅ | — |
| Supprimer colonne | ✅ | ✅ | — |
| Alignement colonnes (L/C/R) | ✅ | ✅ | — |
| **Redimensionner colonnes (drag)** | ✅ fluide | ⚠️ | Moins fluide |
| **Sélection multi-cellules** | ✅ click+drag | ❌ | |
| **Fusion de cellules** (colspan) | ✅ | ❌ | |
| Supprimer table | ✅ | ✅ | — |
| Navigation Tab/Shift+Tab | ✅ | ✅ | — |

## 4. CODE BLOCKS — Comparaison détaillée

| Fonctionnalité | MarkText | MiraMD | Écart |
|---|---|---|---|
| Syntax highlighting | ✅ Prism (100+ langages) | ✅ Lowlight (15 langages) | Beaucoup moins de langages |
| **Sélection de langage** | ✅ CodePicker UI dropdown | ❌ | Pas d'UI, saisie manuelle |
| **Bouton copier code** | ✅ | ❌ | |
| **Numéros de ligne** | ✅ configurable | ⚠️ toggle existe, pas affiché | |
| **Trim lignes vides** | ✅ configurable | ❌ | |
| **Font code configurable** | ✅ famille + taille | ❌ | Font fixe |

## 5. IMAGES — Comparaison détaillée

| Fonctionnalité | MarkText | MiraMD | Écart |
|---|---|---|---|
| Insertion markdown | ✅ | ✅ | — |
| **Image Picker UI** (dialog insertion) | ✅ | ❌ | |
| **Image Toolbar** (align, size, title) | ✅ | ❌ | |
| **Resize handles** (drag corners) | ✅ | ❌ | |
| **Alignement** (inline/left/center/right) | ✅ | ❌ | |
| Paste image | ✅ avec options dossier | ⚠️ base64 seulement | |
| Drag & drop | ✅ | ⚠️ basique | |
| **Copie auto vers dossier assets** | ✅ configurable | ❌ | |

## 6. RECHERCHE & REMPLACEMENT

| Fonctionnalité | MarkText | MiraMD | Écart |
|---|---|---|---|
| **Ctrl+F (dans document)** | ✅ Dialog inline, highlight matches | ❌ | Critique |
| **Find Next/Previous** (F3) | ✅ | ❌ | |
| **Replace** (Ctrl+R) | ✅ single + all | ❌ | |
| **Regex support** | ✅ | ❌ | |
| **Case sensitive** | ✅ | ❌ (sidebar: ✅) | |
| **Whole word** | ✅ | ❌ (sidebar: ✅) | |
| Recherche sidebar | ✅ | ✅ | — |
| **Recherche dans dossier** | ✅ Ctrl+Shift+F avancée | ⚠️ sidebar basique | |

## 7. MENUS APPLICATION

| Menu | MarkText | MiraMD | Écart |
|---|---|---|---|
| **File** | ✅ New/Open/Save/SaveAs/Export/Import/Print/Move/Rename | ⚠️ New/Open/Save via raccourcis | Pas de menu visible, pas de SaveAs/Export/Print |
| **Edit** | ✅ Undo/Redo/Cut/Copy/Paste/Find/Replace/Duplicate/Line Ending | ❌ | Aucun menu Edit |
| **Format** | ✅ Bold/Italic/Underline/Strike/Highlight/Code/Math/Link/Image | ❌ | Aucun menu Format |
| **Paragraph** | ✅ H1-H6/Table/Code/Quote/Math/HTML/Lists/HR/FrontMatter | ❌ | Aucun menu Paragraph |
| **View** | ✅ Command Palette/Source/Typewriter/Focus/Sidebar/TOC/TabBar | ❌ | Aucun menu View |
| **Window** | ✅ Minimize/Zoom/Fullscreen/Always on top | ❌ | |
| **Help** | ✅ Docs/Changelog/About/Updates | ❌ | |

## 8. PRÉFÉRENCES — Comparaison

| Catégorie | MarkText (52 settings) | MiraMD (~20 settings) | Écart |
|---|---|---|---|
| **Thème** | ✅ 6 + auto-switch OS | ✅ 6 thèmes | Pas d'auto-switch |
| **Langue** | ⚠️ 1 seule (EN) | ✅ 8 langues | **MiraMD supérieur** |
| **Police texte** | ✅ famille + taille + line-height | ✅ | — |
| **Police code** | ✅ famille + taille séparées | ❌ | |
| **Auto-save** | ✅ toggle + délai | ⚠️ setting existe, pas branché | |
| **Auto-pair** | ✅ 3 options (brackets, markdown, quotes) | ✅ 1 extension globale | Moins granulaire |
| **Tab size** | ✅ 1-4 configurable | ❌ | |
| **Encodage fichier** | ✅ 33 encodages + auto-detect | ❌ | |
| **Fin de ligne** (LF/CRLF) | ✅ configurable | ❌ | |
| **Largeur éditeur** | ✅ ch/px/% | ❌ | |
| **Direction texte** (LTR/RTL) | ✅ | ❌ | |
| **Spell check** | ✅ langue + underline + dico custom | ⚠️ toggle seulement | |
| **Image settings** | ✅ action, dossier, path relatif | ❌ | |
| **Markdown** | ✅ list style, heading style, footnotes, superscript, HTML, GitLab compat | ❌ section "coming soon" | |
| **Key bindings editor** | ✅ UI complète edit/reset/unbind | ❌ | |
| **Démarrage** | ✅ blank/folder/lastState | ❌ | |
| **Zoom** | ✅ 50%-200% | ❌ | |
| **Scrollbar masquable** | ✅ | ❌ | |
| **Word wrap in TOC** | ✅ | ❌ | |
| **File sort order** | ✅ created/modified/title | ❌ | |
| **Trailing newline** | ✅ 4 modes | ❌ | |
| **Hide link popup** | ✅ | ❌ | |
| **Hide quick insert hint** | ✅ | ❌ | |

## 9. FONCTIONNALITÉS GLOBALES

| Fonctionnalité | MarkText | MiraMD | Écart |
|---|---|---|---|
| Multi-tabs | ✅ | ✅ | — |
| Sidebar fichiers | ✅ | ✅ | — |
| Sidebar TOC | ✅ | ✅ | — |
| Sidebar recherche | ✅ | ✅ | — |
| Focus mode | ✅ | ✅ | — |
| Typewriter mode | ✅ | ✅ | — |
| Source code mode | ✅ CodeMirror + syntax highlight | ⚠️ textarea basique | Pas de syntax highlighting |
| **Split view** | ❌ | ✅ | **MiraMD supérieur** |
| **Command Palette** | ✅ Ctrl+Shift+P | ❌ | |
| **Quick Open** | ✅ Ctrl+P | ❌ | |
| **Export HTML** | ✅ avec 3 thèmes | ❌ | |
| **Export PDF** | ✅ options complètes (taille, header, TOC) | ❌ | |
| **Print** | ✅ Ctrl+P | ❌ | |
| **Save As** | ✅ Ctrl+Shift+S | ❌ | |
| **Move/Rename file** | ✅ | ❌ | |
| **Copy as Markdown** | ✅ Ctrl+Shift+C | ❌ | |
| **Copy as HTML** | ✅ | ❌ | |
| **Paste as Plain Text** | ✅ Ctrl+Shift+V | ❌ | |
| **Duplicate paragraph** | ✅ Ctrl+Alt+D | ❌ | |
| **Create/Delete paragraph** | ✅ | ❌ | |
| **Context menu (clic droit)** | ✅ riche (cut/copy/paste/insert) | ❌ | |
| **Zoom window** | ✅ | ❌ | |
| **Fullscreen** | ✅ F11 | ❌ | |
| **Always on top** | ✅ | ❌ | |
| **Reload images** | ✅ F5 | ❌ | |
| Tray icon | ✅ | ✅ | — |
| Single instance | ✅ | ✅ | — |
| CLI file open | ✅ | ✅ | — |
| Word/char count | ✅ | ✅ | — |
| Unsaved indicator | ✅ | ✅ | — |
| **Tab reordering (drag)** | ✅ | ❌ | |
| **Tab switch (Ctrl+1-9)** | ✅ | ❌ | |
| **Cycle tabs** (Ctrl+Tab) | ✅ | ❌ | |
| **Recent files** | ✅ | ❌ | |

---

## RÉSUMÉ CHIFFRÉ

| Métrique | MarkText | MiraMD | Couverture |
|---|---|---|---|
| **Settings/Préférences** | 52 | ~20 | **38%** |
| **Items de menu** | 90+ | ~10 | **11%** |
| **Raccourcis clavier** | 80+ | ~30 | **37%** |
| **Types de blocs (@ menu)** | 22 fonctionnels | 10 fonctionnels + 12 buggés | **45%** |
| **Fonctionnalités éditeur** | ~50 features | ~25 features | **50%** |
| **Formats export** | 3 (MD, HTML, PDF) | 1 (MD) | **33%** |

### Score global estimé : ~35-40% de parité fonctionnelle avec MarkText

### Points où MiraMD est SUPÉRIEUR à MarkText :
- ✅ **8 langues** (vs 1 seule pour MarkText)
- ✅ **Split View** (n'existe pas dans MarkText)
- ✅ **Taille binaire** : ~5 Mo vs ~200 Mo
- ✅ **RAM** : ~30 Mo vs ~300 Mo
- ✅ **Sécurité** : Tauri sandbox vs Electron nodeIntegration
- ✅ **Stack moderne** : Svelte 5 + Rust vs Vue 2 + Node.js

---

## TOP PRIORITÉS POUR ATTEINDRE LA PARITÉ

### Priorité 1 — Critique (utilisation quotidienne bloquée)
1. 🔴 **Corriger les 8 container blocks** (Math, HTML, Front Matter, Mermaid, Flowchart, Sequence, PlantUML, Vega)
2. ❌ **Ctrl+F / Find & Replace** dans le document
3. ❌ **Save As** (Ctrl+Shift+S)
4. ❌ **Menus application** (File, Edit, Format, Paragraph, View)

### Priorité 2 — Important (expérience utilisateur)
5. ❌ **Inline Math** ($...$) avec rendu KaTeX
6. ❌ **Export HTML / PDF**
7. ❌ **Code Block language picker** UI
8. ❌ **Image toolbar** (align, resize)
9. ❌ **Table picker** (grille visuelle pour choisir la taille)
10. ❌ **Context menu** (clic droit)
11. ❌ **Footnotes**

### Priorité 3 — Complétion (feature parity)
12. ❌ **Command Palette** (Ctrl+Shift+P)
13. ❌ **Quick Open** (Ctrl+P)
14. ❌ **Préférences manquantes** (tab size, encodage, markdown options, keybindings editor)
15. ❌ **Superscript/Subscript**
16. ⚠️ **Source code mode** avec syntax highlighting
17. ❌ **Fullscreen, Zoom, Always on top**
18. ❌ **Copy as Markdown/HTML, Paste as Plain Text**
19. ❌ **Tab management** (reorder, Ctrl+Tab, Ctrl+1-9)
20. ❌ **Recent files**
