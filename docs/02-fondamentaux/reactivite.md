# Réactivité

La [réactivité](../01-decouverte/glossaire.md#reactivite) est le mécanisme par lequel **un changement de valeur déclenche automatiquement la mise à jour de tout ce qui en dépend**. Tu modifies une donnée à un seul endroit, et l'interface entière se réorganise toute seule. C'est l'une des idées les plus puissantes du développement frontend moderne.

## L'analogie d'Excel

Si tu as déjà utilisé un tableur, tu connais déjà la réactivité.

Dans Excel, tu écris dans la cellule **A1** la valeur `10`. Dans **B1**, tu écris la formule `=A1*2`. B1 affiche `20`. Maintenant tu changes A1 à `15`. Que se passe-t-il ? B1 passe automatiquement à `30`. Tu n'as pas eu à recalculer la formule, ni à dire à B1 de se rafraîchir. Excel le fait pour toi parce qu'il **sait** que B1 dépend de A1.

C'est exactement la promesse de la réactivité dans une application : tu déclares les dépendances une fois, et le framework s'occupe des mises à jour.

## Sans réactivité : la mise à jour manuelle

Imagine MiraMD sans réactivité. Tu changes le titre d'un document. Pour que l'interface reste cohérente, tu dois penser à mettre à jour :

- L'**onglet** dans la barre d'onglets.
- La **barre de titre** de la fenêtre.
- La **table des matières** (TOC) si le titre apparaît dedans.
- Le **status** (modifié / non modifié) si le titre vient de changer.
- Le **menu Fenêtre** qui liste les documents ouverts.
- L'**ARIA label** lu par les lecteurs d'écran.

Six endroits à mettre à jour à la main, à chaque modification. Si tu en oublies un, l'interface devient incohérente : l'onglet dit "notes.md" mais la barre de titre dit "untitled". Ce sont les **bugs de désynchronisation**, fléau des applications complexes.

Avec la réactivité, tu écris une seule fois "tel composant dépend de tel store", et tu n'as plus à y penser. Le framework te garantit la cohérence.

## La réactivité dans Svelte

[Svelte](../01-decouverte/glossaire.md#svelte) construit la réactivité autour de la notion de [store](../01-decouverte/glossaire.md#store-svelte). Un store est un conteneur de valeur sur lequel les composants peuvent **s'abonner**.

### Lire un store

Dans un composant Svelte, on lit la valeur courante d'un store en préfixant son nom par `$` :

```svelte
<script>
  import { editor } from '$lib/stores/editor'
</script>

<h1>{$editor.currentTab?.title ?? 'Sans titre'}</h1>
```

À chaque fois que `editor` change, le composant **se rafraîchit automatiquement**. Pas besoin d'écouter, de souscrire, de désinscrire. Svelte le gère.

### Modifier un store

On change la valeur d'un store via sa méthode `set` (ou `update`) :

```ts
editor.update(state => ({
  ...state,
  currentTab: { ...state.currentTab, title: 'nouveau titre' }
}))
```

Une seule ligne, et **toute l'interface qui dépend de `editor.currentTab.title` se met à jour** : l'onglet, la barre de titre, la TOC, le status. Pas de risque d'oubli.

## Le cas MiraMD

MiraMD a 4 stores principaux qui orchestrent la réactivité de toute l'application :

- **`editor`** : la liste des onglets ouverts, l'onglet courant, son contenu, ses méta-données. C'est le plus gros store.
- **`preferences`** : les réglages utilisateur (thème, font, taille de texte, mode auto-save).
- **`toast`** : les messages temporaires affichés en bas de l'écran.
- **`muyaInstance`** : la référence à l'instance Muya courante.

Quand l'utilisateur ouvre un nouveau fichier, le store `editor` reçoit un nouvel onglet. Instantanément :

- La barre d'onglets affiche le nouvel onglet.
- L'onglet précédent perd le focus visuel.
- La table des matières recalcule pour le nouveau document.
- La status bar met à jour le compteur de mots.
- Le titre de la fenêtre change.

Une seule ligne de code (`editor.addTab(...)`) déclenche cette cascade. Sans réactivité, il faudrait six appels manuels et un test exhaustif pour vérifier qu'on n'en a pas oublié un.

## Pourquoi c'est puissant

La réactivité repose sur une discipline : **une seule source de vérité**. Pour chaque donnée, il y a un et un seul endroit où elle vit (le store). Tout le reste de l'application *lit* cette donnée mais ne la duplique pas.

Conséquence : impossible que deux endroits affichent des valeurs différentes pour la même chose. Le bug de désynchronisation devient structurellement impossible.

Le revers : il faut bien **modéliser ses stores**. Mal découper les responsabilités amène à des stores trop gros, ou à des dépendances croisées entre stores. C'est un sujet de design qui se travaille avec l'expérience.

## Pour aller plus loin

- Pour le détail des 4 stores de MiraMD, va voir [`04-architecture/frontend-svelte.md`](../04-architecture/frontend-svelte.md).
- Pour comprendre pourquoi Svelte ne passe pas par un [Virtual DOM](../01-decouverte/glossaire.md#virtual-dom) pour faire de la réactivité, va voir [`02-fondamentaux/virtual-dom.md`](virtual-dom.md).
- Pour le choix de Svelte vs Vue/React, va voir [`03-choix-techniques/02-svelte-vs-vue-react.md`](../03-choix-techniques/02-svelte-vs-vue-react.md).
