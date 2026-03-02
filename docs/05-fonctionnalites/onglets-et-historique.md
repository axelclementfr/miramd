# Onglets et historique

Plusieurs fichiers Markdown ouverts en parallèle, chacun avec son propre historique d'annulation. C'est l'une des fonctionnalités les plus délicates de MiraMD parce qu'elle empile **trois mécanismes** : l'historique interne de [Muya](../01-decouverte/glossaire.md#muya), un cache d'historique par onglet côté MiraMD, et une interception manuelle des raccourcis Ctrl+Z / Ctrl+Y. Les trois doivent rester synchronisés, et c'est là que les bugs apparaissent.

## Vue utilisateur

**Multi-onglets.**

- Plusieurs fichiers peuvent être ouverts en même temps, chacun dans son propre onglet (en haut de la fenêtre, dans la `TabBar`).
- Tu navigues d'un onglet à l'autre en cliquant dessus. Le contenu, la position du curseur (et l'historique d'annulation) se restaurent à chaque switch.
- Un astérisque à côté du nom de l'onglet indique qu'il a des modifications non sauvegardées. Cf. [`gestion-fichiers.md`](gestion-fichiers.md) pour l'enregistrement.
- `Ctrl+W` ferme l'onglet courant (avec dialogue de confirmation si modifié).

**Annuler / Rétablir.**

- `Ctrl+Z` annule la dernière modification.
- `Ctrl+Shift+Z` ou `Ctrl+Y` rétablit (redo).
- L'historique est **par onglet** : annuler dans l'onglet A ne touche pas l'onglet B.
- Quand tu changes d'onglet et reviens, l'historique de cet onglet est **restauré** : tu peux annuler des actions faites avant le switch.

**Comportement attendu sur un scénario typique** :

1. Tu écris dans l'onglet A.
2. Tu switch vers l'onglet B, écris quelques lignes.
3. Tu reviens vers l'onglet A.
4. `Ctrl+Z` doit annuler la dernière frappe faite dans A (avant le switch), pas dans B.

## Implémentation

C'est ici que ça devient subtil. Trois couches sont impliquées et doivent rester cohérentes.

### Couche 1 — Historique interne de Muya

Muya gère son propre historique. Chaque modification (frappe, suppression, transformation de bloc) est ajoutée à une stack interne (vendored dans `src/lib/muya/lib/history.js`). Muya expose les méthodes `undo()`, `redo()`, `clearHistory()`, `getHistory()`, `setHistory(snapshot)`.

### Couche 2 — Cache d'historique par onglet

`src/lib/services/historyCache.ts` est un singleton minimaliste — une `Map<tabId, history>`. Il expose :

- `get(tabId)` → renvoie le snapshot d'historique stocké pour cet onglet.
- `set(tabId, history)` → stocke le snapshot.
- `delete(tabId)` → supprime (à la fermeture d'un onglet).
- `cleanUp(activeTabIds)` → purge les entrées orphelines.

Le cache vit en mémoire seulement (pas persisté sur disque). Si tu fermes MiraMD, l'historique est perdu — c'est cohérent avec le comportement attendu.

### Couche 3 — Interception clavier en *capture phase*

C'est la couche la plus contre-intuitive. Dans `src/lib/components/editor/MuyaPane.svelte` :

```ts
const editorKeydown = (e: KeyboardEvent) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    muyaService.undo();
  } else if (e.key === 'z' && e.shiftKey) { ... muyaService.redo(); }
  else if (e.key === 'y') { ... muyaService.redo(); }
  else if (e.key === 'a') { ... muyaService.selectAll(); }
};
paneElement.addEventListener('keydown', editorKeydown, true); // capture phase
```

Pourquoi en *capture phase* (le `true` final) ? Parce que [WebKitGTK](../01-decouverte/glossaire.md#webkitgtk) (la [WebView](../01-decouverte/glossaire.md#webview) utilisée par [Tauri](../01-decouverte/glossaire.md#tauri) sur Linux) ne supporte pas correctement le comportement `contenteditable` natif pour Ctrl+Z. Sans interception, le navigateur essaye d'annuler à sa façon, ce qui produit des incohérences avec l'historique de Muya. En interceptant en capture, on bypass le navigateur et on délègue tout à `muyaService.undo()`.

### Orchestration au changement d'onglet

Dans `MuyaPane.svelte`, un `subscribe(activeTab)` détecte le switch :

```ts
unsubs.push(editorStore.activeTab.subscribe((tab) => {
  if (!tab || !muya) return;
  if (tab.id !== prevTabId) {
    // 1. Sauvegarde l'historique de l'onglet qu'on quitte
    if (prevTabId) {
      historyCache.set(prevTabId, muya.getHistory());
    }
    prevTabId = tab.id;
    loadingTab = true;

    // 2. Charge le contenu du nouvel onglet
    muya.setMarkdown(tab.content);

    // 3. Restaure l'historique du nouvel onglet, ou repart de zéro
    const cached = historyCache.get(tab.id);
    if (cached) muya.setHistory(cached);
    else muya.clearHistory();

    setTimeout(() => { loadingTab = false; }, 50);
  }
}));
```

Le flag `loadingTab` empêche les events `change` émis par `setMarkdown()` de polluer l'onglet pendant le chargement.

**Composants Svelte concernés** :

- `src/lib/components/editor/MuyaPane.svelte` — interception clavier capture phase, orchestration save/restore historique au tab switch.
- `src/lib/components/TabBar.svelte` — affichage de la barre, click pour activer un onglet, croix pour fermer.

**Services concernés** :

- `src/lib/services/historyCache.ts` — la `Map<tabId, history>`.
- `src/lib/services/muya.ts` — expose `getHistory()`, `setHistory()`, `clearHistory()`, `undo()`, `redo()` autour de l'instance Muya.
- `src/lib/services/shortcuts.ts` — gère les raccourcis globaux (Ctrl+O, Ctrl+S, etc.) **mais pas** Ctrl+Z/Y, qui sont délégués à `MuyaPane`.

**Backend Rust impliqué** : aucun. L'historique vit entièrement en mémoire frontend. Le seul appel IPC visible dans cette logique est `debug_log` (no-op en release), qui sert à tracer en dev.

**Stores impactés** :

- `editor.tabs` — la liste des onglets ouverts, leur contenu, leur état modifié.
- `editor.activeTabId` — l'identifiant de l'onglet actif. Toute modification déclenche le subscribe de `MuyaPane`.
- `editor.activeTab` — store dérivé pour récupérer l'onglet courant directement.

## Pièges connus

- **Ctrl+Z mal géré au tab switch** ⚠️ : c'est le bug le plus visible. Annuler après un changement d'onglet ramène parfois à un état inattendu, ne fait rien, ou semble sauter des étapes. Voir [`problemes-connus.md#ctrlz-se-comporte-mal-au-changement-donglet`](../06-references/problemes-connus.md#ctrlz-se-comporte-mal-au-changement-donglet).

  Le diagnostic suspecté : les trois couches (Muya interne, `historyCache`, intercept capture) se marchent dessus dans certains scénarios. Notamment :
  - Si `historyCache.set()` est appelé **avant** que Muya ait fini de traiter la dernière frappe (debounce 100 ms du `change` qui n'a pas encore terminé), le snapshot sauvé est partiel.
  - L'intercept en capture bypass complètement l'état natif du contenteditable, ce qui veut dire que toute logique d'undo qui s'appuierait sur ce dernier (jamais le cas explicite ici, mais Muya pourrait subtilement) tombe à côté.
  - Le format renvoyé par `getHistory()` est opaque (héritage Muya). Si une version interne change la structure, `setHistory()` peut soit échouer silencieusement, soit reconstruire un état incohérent.

- **Pas de Ctrl+Tab** documenté pour naviguer entre onglets (à vérifier dans les raccourcis). Le seul moyen actuel de switcher est le clic sur l'onglet.

- **Cleanup du cache** : `historyCache.cleanUp()` est appelé à chaque modification de la liste des onglets. Si un bug ne déclenche pas la mise à jour de cette liste, des entrées peuvent s'accumuler en mémoire (peu probable en pratique).

- **Pas de tests d'intégration** sur le scénario "tape, switch, switch back, undo". Recommandé en P0 dans l'audit (`06-references/audit.md`).

## Pour aller plus loin

- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — où se situe le couple "MuyaPane + historyCache" dans les trois couches.
- [`04-architecture/integration-muya.md`](../04-architecture/integration-muya.md) — comment Muya est embarqué et pourquoi la passerelle `MuyaService` existe.
- [`edition-wysiwyg.md`](edition-wysiwyg.md) — la couche d'édition elle-même, qui produit les modifications dont on garde la trace ici.
- [`gestion-fichiers.md`](gestion-fichiers.md) — comment un onglet est créé / fermé / sauvegardé sur disque.
- [`06-references/problemes-connus.md`](../06-references/problemes-connus.md) — les bugs ouverts liés à cette zone du code.
