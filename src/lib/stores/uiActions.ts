import { writable } from 'svelte/store';

/** Pointers vers des actions UI cross-composant (registrées par leurs owners
 * au montage). Évite de descendre des callbacks via 3 niveaux de props ou
 * d'exposer des refs vers des composants comme `Sidebar.openFolder`.
 *
 * Pattern : le composant qui sait FAIRE l'action s'enregistre via
 * `uiActions.update(a => ({ ...a, openFolder }))` dans son `onMount`. */
interface UIActions {
	openFolder?: () => Promise<void> | void;
}

export const uiActions = writable<UIActions>({});
