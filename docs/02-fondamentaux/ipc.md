# IPC — Communication entre processus

[IPC](../01-decouverte/glossaire.md#ipc) est l'acronyme de *Inter-Process Communication*. C'est la façon dont **deux processus distincts** s'échangent des messages sur la même machine. Dans MiraMD, c'est le canal qui relie le frontend (l'interface, dans une [WebView](../01-decouverte/glossaire.md#webview)) au backend ([Rust](../01-decouverte/glossaire.md#rust), qui touche au système).

## Pourquoi deux processus

Une application moderne n'est presque jamais un seul bloc d'exécution. Elle vit dans plusieurs [processus](../01-decouverte/glossaire.md#process) qui ont chacun un rôle distinct.

Pour MiraMD :

- Un **processus frontend** affiche la fenêtre, dessine les composants Svelte, écoute les frappes clavier. Il tourne dans la WebView.
- Un **processus backend** lit et écrit les fichiers, parse le Markdown via [comrak](../01-decouverte/glossaire.md#comrak), gère les préférences. Il tourne en Rust natif.

Le système d'exploitation isole ces deux processus l'un de l'autre. Le frontend ne peut pas accéder à la mémoire du backend, et inversement. C'est une **bonne chose pour la sécurité** : si une page malicieuse arrivait à exécuter du code dans la WebView, elle ne pourrait pas directement supprimer les fichiers de l'utilisateur.

Mais pour faire fonctionner l'application, il faut bien que ces deux processus se parlent. C'est là qu'intervient l'IPC.

## L'analogie du guichet de banque

Tu rentres dans une banque. Tu veux retirer 200 euros. Comment ça se passe ?

- Tu **ne vas pas dans le coffre**. Personne ne te laisse passer derrière le comptoir, fouiller dans les billets, te servir tout seul.
- Tu vas au **guichet**. Tu remplis un bordereau qui dit : "je veux retirer 200 euros sur le compte numéro X".
- Le guichetier **vérifie ton identité**. Il regarde si tu as bien le droit de retirer. Si oui, il va chercher les billets et te les remet.
- Si tu demandes 50 000 euros sans justification, **il refuse**.

L'IPC fonctionne pareil. Le frontend (toi) ne peut pas accéder directement aux fichiers (le coffre). Il **passe une commande** au backend (le guichetier). Le backend valide la demande. Si elle est légitime, il l'exécute et renvoie le résultat. Sinon, il refuse.

## Le mécanisme dans Tauri

[Tauri](../01-decouverte/glossaire.md#tauri) fournit deux primitives pour faire de l'IPC : `invoke` côté frontend, et `#[tauri::command]` côté backend.

### Côté frontend (JavaScript/TypeScript)

```ts
import { invoke } from '@tauri-apps/api/core'

const content = await invoke('read_file', { path: '/home/me/notes.md' })
```

Tu appelles `invoke` avec **le nom de la commande** et **les arguments**. Tauri se charge d'envoyer le message au backend, d'attendre la réponse, et de te la rendre comme une promesse JavaScript classique.

### Côté backend (Rust)

```rust
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    // valider le chemin, lire le fichier, renvoyer le contenu
}
```

L'attribut `#[tauri::command]` marque une fonction Rust comme **exposée à l'IPC**. Le nom de la fonction (`read_file`) doit correspondre au nom passé à `invoke`. Les arguments sont automatiquement convertis depuis JSON via [Serde](../01-decouverte/glossaire.md#serde) — sans plonger dans le détail, c'est lui qui transforme l'objet JS `{ path: '...' }` en argument Rust `path: String`.

Pour que Tauri trouve la commande, il faut aussi la déclarer au démarrage de l'application (dans `lib.rs`).

### La sérialisation JSON

Les deux processus n'utilisent pas le même langage. Le frontend pense en JavaScript, le backend pense en Rust. Pour s'envoyer des messages, ils utilisent un **format pivot universel** : JSON.

- Côté frontend, l'objet JavaScript `{ path: '/home/me/notes.md' }` devient la chaîne `{"path":"/home/me/notes.md"}`.
- Tauri transmet cette chaîne au backend.
- Côté backend, Serde lit la chaîne et reconstruit une struct Rust avec les mêmes valeurs.

Tout transite par JSON. C'est pratique mais ça impose une contrainte : ce que tu envoies doit être **sérialisable**. Tu ne peux pas envoyer une fonction, une connexion réseau, ou un pointeur. Du texte, des nombres, des objets simples, oui.

## Pourquoi c'est sécurisant

L'IPC de Tauri est **explicite**. Le frontend ne peut pas appeler n'importe quelle fonction Rust : il peut appeler **uniquement les fonctions marquées `#[tauri::command]` et déclarées dans la liste**. Tout le reste du code Rust est invisible depuis la WebView.

Cette philosophie change tout par rapport à un Electron classique. Dans Electron avec `nodeIntegration: true`, le frontend a accès à `require('fs')` et peut faire `fs.unlinkSync('/n'importe-quel/fichier')`. Dans Tauri, il doit passer par une commande explicite, qui peut valider le chemin, vérifier la taille, refuser les chemins suspects.

MiraMD a 9 commandes IPC déclarées : `read_file`, `write_file`, `parse_markdown`, `load_preferences`, `save_preferences`, et quelques autres. Chacune fait **une chose précise** et valide ses entrées. Si demain on voulait permettre de supprimer un fichier, il faudrait ajouter explicitement `delete_file` avec ses validations propres. Pas d'accès "fourre-tout" possible.

## Les capabilities

Pour aller encore plus loin, Tauri demande aussi de déclarer une [capability](../01-decouverte/glossaire.md#capability-tauri) qui dit "tel composant frontend a le droit d'appeler tel groupe de commandes". Sans la capability correspondante, l'appel échoue, même si la commande existe. C'est une couche supplémentaire qui sera détaillée dans [`04-architecture/securite.md`](../04-architecture/securite.md).

## Pour aller plus loin

- Pour la liste complète des commandes IPC de MiraMD avec leur signature, va voir [`04-architecture/backend-rust.md`](../04-architecture/backend-rust.md).
- Pour le détail de la sécurité (capabilities, CSP, validations), va voir [`04-architecture/securite.md`](../04-architecture/securite.md).
- Pour des exemples de flux IPC complets (ouvrir un fichier, sauvegarder), va voir [`04-architecture/flux-de-donnees.md`](../04-architecture/flux-de-donnees.md).
