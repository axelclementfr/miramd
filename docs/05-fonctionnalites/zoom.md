# Zoom de l'application

MiraMD propose un zoom **global** qui scale toute l'interface — le texte, les icônes, les paddings, les scrollbars, les images — de manière uniforme et responsive. C'est exactement le comportement attendu d'un éditeur moderne (MarkText, navigateurs web), et c'est techniquement le même mécanisme que `Ctrl+=` / `Ctrl+-` dans Chrome ou Firefox.

## Vue utilisateur

**Trois manières de zoomer** :

- **Ctrl+molette** (ou Cmd+molette sur macOS) — zoom in/out par pas de 10% par tick (même pas que le slider, pour un feeling brisk type MarkText/navigateur). Le scroll de la page est intercepté.
- **Slider dans Settings > Général** — réglage par pas de 10%, range 50% à 200%. Le zoom s'applique au relâchement de la souris (preview pendant le drag, commit à la fin).
- **Indicateur dans la status bar** — affiche le pourcentage courant. Cliquer dessus réinitialise le zoom à 100%.

**Persistance.** Le zoom est enregistré dans les préférences (`zoom` dans `~/.config/miramd/preferences.json`) et restauré au démarrage suivant.

**Limites.** Range autorisée : 50% à 200%. Au-delà, la valeur est tronquée silencieusement (clamp à la fois côté frontend et côté backend, défense en profondeur).

## Distinction avec la taille de police

Deux notions **complètement indépendantes** :

| Réglage | Effet | Où le trouver |
|---|---|---|
| **Zoom** | Scale l'**ensemble** de l'application (sidebar, status bar, modal, éditeur, icônes) | Settings > Général, Ctrl+molette, status bar |
| **Taille de police** | Affecte **uniquement** le contenu du fichier (corps de l'éditeur Muya) | Settings > Éditeur |

Combinaison : si tu mets l'éditeur à 24px et le zoom à 100%, seul le contenu du fichier est en 24px. Si tu mets l'éditeur à 16px et le zoom à 150%, tout est scalé visuellement de 1.5× (rendu effectif du contenu fichier ≈ 24px aussi, mais sidebar et status bar sont scalées en plus).

## Implémentation

**Backend Rust** — `src-tauri/src/lib.rs` :

```rust
#[tauri::command]
fn set_app_zoom(window: tauri::WebviewWindow, scale: f64) -> Result<(), String> {
    window.set_zoom(scale).map_err(|e| e.to_string())
}
```

C'est l'API Tauri 2 `WebviewWindow::set_zoom` qui appelle directement `webkit_web_view_set_zoom_level` côté WebKitGTK. L'équivalent exact de `webContents.setZoomFactor` dans Electron.

**Frontend services** :

- `src/lib/services/zoom.ts` — souscrit à `preferences.zoom`, appelle `invoke('set_app_zoom', { scale })` à chaque changement. Singleton avec `init()` / `destroy()`. Déduplique les valeurs identiques pour éviter des IPC redondants.
- `src/lib/services/appZoomWheel.ts` — installe un listener `wheel` global (capture phase, `passive: false`). Quand `ctrlKey` ou `metaKey` est tenu, calcule le delta (10% par tick), clampe entre `MIN_ZOOM` (0.5) et `MAX_ZOOM` (2.0). **Performance** : appelle `invoke('set_app_zoom', ...)` directement à chaque tick pour un feedback visuel instantané, et débounce `preferences.patch()` (200ms) pour ne pas saturer l'IPC bridge avec des `save_preferences` à chaque pixel de scroll. La status bar ne reflète le nouveau % qu'après les 200ms d'inactivité — trade-off assumé pour la fluidité.
- `src/lib/services/fontSize.ts` — service séparé qui ne touche **que** la police de l'éditeur Muya via `muyaService.setFont()`. Aucune multiplication par le zoom : depuis la refonte, ces deux notions sont découplées.

**Composants UI** :

- `src/lib/components/StatusBar.svelte` — bouton `.zoom-indicator` qui affiche `Math.round(prefs.zoom * 100) + '%'` et appelle `preferences.patch({ zoom: 1.0 })` au clic. Couleur d'accent quand zoom ≠ 100%.
- `src/lib/components/settings/GeneralSection.svelte` — slider `<input type="range">` lié à `prefs.zoom` avec `onchange={applyPrefs}` (pas `oninput`) pour le pattern preview-puis-commit.

**Constants** — `src/lib/constants.ts` :

```ts
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.0;
export const DEFAULT_ZOOM = 1.0;
export const ZOOM_STEP = 0.1;         // slider et commandes discrètes
export const ZOOM_STEP_WHEEL = 0.05;  // molette, plus fin
```

## Raccourcis Ctrl+= / Ctrl+- / Ctrl+0 — réassignés

Avant la refonte, `Ctrl+=`, `Ctrl+-` et `Ctrl+0` zoomaient l'application. Ces raccourcis sont désormais **réservés à l'édition** : ils modifient le niveau de heading de la ligne courante, comme dans MarkText.

| Touche | Effet sur un paragraphe | Effet sur un heading hN |
|---|---|---|
| `Ctrl+=` | → `###### h6` (le plus petit niveau) | h6→h5→h4→h3→h2→h1 (vers le plus gros) |
| `Ctrl+-` | no-op | h1→h2→…→h6→plain (vers le plus petit) |
| `Ctrl+0` | no-op | n'importe quel hN → plain |

Mental model : `+` rend le texte visuellement **plus gros** (vers h1, qui est le plus grand heading), `-` rend **plus petit**, `0` enlève le heading.

**Implémentation** : dans `src/lib/components/editor/MuyaPane.svelte`, capture phase keydown qui appelle `muyaService.shiftHeadingUp()` / `shiftHeadingDown()` / `resetToParagraph()`. Ces méthodes délèguent à l'API interne Muya `muya.updateParagraph('upgrade heading' | 'degrade heading' | 'paragraph')`.

## Edge cases

- **Bloc de code, cellule de tableau, blockquote, math block** : Muya valide la transformation avec `isAllowedTransformation` et la rejette silencieusement. No-op attendu.
- **Item de liste** : la transformation s'applique sur la ligne du caret et convertit ce nœud en heading, perdant le contexte de liste pour cette ligne. C'est le comportement choisi (cf. l'exemple "ajouter `####` à un texte dans une liste pour qu'il soit plus visible").
- **Multi-sélection sur N blocs** : Muya rejette si `start.key !== end.key`. Seul le bloc contenant le caret est affecté.
- **Tauri devtools** : ont leur propre zoom indépendant. Pas un bug.

## Voir aussi

- [`preferences.md`](preferences.md) — système de préférences global.
- [`themes.md`](themes.md) — l'autre dimension visuelle (couleurs).
- Spec de la refonte : [`../superpowers/specs/2026-05-08-zoom-redesign-design.md`](../superpowers/specs/2026-05-08-zoom-redesign-design.md).
