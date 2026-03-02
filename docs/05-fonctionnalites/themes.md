# Thèmes

MiraMD propose 6 thèmes visuels prédéfinis. Le changement est immédiat, sans rechargement, et persisté dans les [préférences](preferences.md).

## Vue utilisateur

Les six thèmes :

- **Light** — fond clair, texte sombre. Le réglage par défaut sur certains environnements.
- **Dark** — fond sombre uniforme, texte clair. C'est le thème par défaut au premier démarrage de MiraMD.
- **One Dark** — variante sombre inspirée du thème "One Dark" populaire sur les éditeurs de code.
- **Graphite** — sidebar foncée + zone d'éditeur claire. Hybride. Idéal si tu préfères une interface sombre mais un fond de lecture blanc.
- **Material Dark** — sombre avec une palette inspirée du Material Design.
- **Ulysses** — variante claire et minimaliste, ambiance "papier".

**Comment changer de thème.**

- `Ctrl+,` ouvre les [préférences](preferences.md).
- Onglet **Thème** sur la gauche du panneau.
- Tu vois une liste avec un aperçu visuel par thème. Cliquer sur l'un d'eux applique le changement immédiatement, dans toute l'application.
- Le choix est persisté — au prochain redémarrage, MiraMD repart sur ton thème.

**Comportement particulier — Graphite.** Ce thème est le seul "hybride" : la barre latérale et la barre d'icônes restent foncées, mais la zone d'éditeur est claire. C'est un choix volontaire, qui demande des règles CSS spécifiques (cf. ci-dessous).

## Implémentation

Le mécanisme est entièrement basé sur **CSS variables + attribut `data-theme`** sur l'élément racine `<html>`. Aucun JavaScript ne change de classe sur les composants : tout passe par le système de cascade CSS.

**Composants Svelte concernés** :

- `src/routes/+page.svelte` — au boot et à chaque changement de la préférence `theme`, applique :
  ```ts
  document.documentElement.setAttribute('data-theme', p.theme);
  ```
  Ce simple attribut suffit à activer la branche CSS correspondante.
- `src/lib/components/settings/ThemeSection.svelte` — la section "Thème" du panneau de préférences. Affiche les options et appelle `preferences.patch({ theme: 'dark' })` à la sélection.

**Services concernés** : aucun service dédié. Le changement se fait directement via le store `preferences` et l'attribut DOM.

**Fichiers de styles** :

- `src/lib/styles/themes.css` — la définition des 6 thèmes. Chacun est introduit par un sélecteur `:root[data-theme='<nom>']` qui définit toutes les variables CSS (couleurs de fond, texte, accent, bordures, etc.).
  ```css
  :root[data-theme='dark'] {
    --bg-primary: #2c2c2c;
    --text-primary: #e0e0e0;
    /* ... */
  }
  ```
- `src/lib/styles/global.css` — variables globales, fallbacks, et règles communes à tous les thèmes.
- `src/lib/styles/editor.css` — styles spécifiques à la zone d'édition Muya, qui consomment ces variables.

**Cas particulier Graphite.** Pour avoir sidebar foncée + éditeur clair, `themes.css` ajoute des sélecteurs ciblés :

```css
:root[data-theme='graphite'] .sidebar,
:root[data-theme='graphite'] .sidebar-icons {
  /* couleurs sombres locales */
}
```

C'est un override en surcharge de la règle générique du thème, plutôt qu'un thème complètement séparé. Pratique mais demande de la vigilance : un nouveau composant qui ne consomme pas explicitement les variables CSS appropriées peut sembler "cassé" sous Graphite.

**MutationObserver dans Muya.** Muya, qui est chargé en script global (`window.Muya`), n'est pas natif Svelte et ne réagit pas automatiquement aux changements d'attribut sur `<html>`. Pour ajuster son rendu interne (par exemple les couleurs de syntaxe dans un bloc de code), Muya utilise un `MutationObserver` qui écoute les changements de `data-theme` sur la racine et adapte ses tokens de coloration. C'est de la "magie locale" embarquée dans le moteur vendored.

**Backend Rust impliqué** : aucun. Le thème est une préférence comme une autre. Le backend ne sait pas quel thème est actif — il stocke juste la string dans `preferences.json`.

**Stores impactés** :

- `preferences.theme` — string parmi `'light' | 'dark' | 'one-dark' | 'graphite' | 'material-dark' | 'ulysses'`.

## Pièges connus

Aucun piège connu actuellement. Le mécanisme `data-theme` + variables CSS est simple et fiable, sans bug ouvert recensé. Quelques points d'attention pour les contributeurs :

- **Si tu ajoutes un composant**, consomme **les variables CSS** (`var(--bg-primary)`, `var(--text-primary)`, etc.) plutôt que des couleurs en dur. Sinon, ton composant ne suivra pas le thème.
- **Si tu ajoutes un thème**, n'oublie pas de copier les overrides spécifiques de Graphite si tu veux le même effet hybride. Sinon, fais un thème "uniforme".
- **Aperçu CSP** : les couleurs et thèmes sont 100 % statiques dans `themes.css`, pas de chargement dynamique. Pas d'impact CSP.

## Pour aller plus loin

- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — où le subscribe au `preferences.theme` est déclenché dans le boot.
- [`preferences.md`](preferences.md) — comment toutes les préférences (y compris le thème) sont stockées et synchronisées.
- [`02-fondamentaux/reactivite.md`](../02-fondamentaux/reactivite.md) — la [réactivité](../01-decouverte/glossaire.md#réactivité) [Svelte](../01-decouverte/glossaire.md#svelte) qui rend immédiat le changement de thème.
