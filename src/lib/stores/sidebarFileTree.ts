import type { OpenedProject } from '$lib/types/filesystem';
import { writable } from 'svelte/store';

/** État persistant du panneau Files dans la sidebar. Promu en stores parce que
 *  `Sidebar.svelte` utilise `{#key rightColumn}` qui détruit/recrée FileTreePane
 *  à chaque changement d'onglet (Files → Search → Files), et que toggling la
 *  sidebar entière unmount aussi le composant. Sans persistance via stores,
 *  les dossiers ouverts disparaissaient à chaque mount/unmount.
 *
 *  Note : `openedTabs` / `activeTabId` viennent déjà du store `editor`, donc
 *  pas besoin de les dupliquer ici. Idem `tr` (i18n store). */
export const openedProjects = writable<OpenedProject[]>([]);
export const openedFilesCollapsed = writable<boolean>(false);
