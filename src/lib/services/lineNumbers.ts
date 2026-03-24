import { preferences } from '$lib/stores/preferences';

/**
 * Line numbers service — manages two independent features:
 * 1. Editor line numbers: shows line numbers for ALL paragraphs
 * 2. Code block line numbers: passed to Muya via options (handled by muyaService)
 *
 * This service only handles #1 by toggling CSS class on the wysiwyg-pane.
 * The CSS rules are in editor.css targeting `.wysiwyg-pane.show-line-numbers`.
 */
class LineNumbersService {
	private unsub: (() => void) | null = null;
	private paneElement: HTMLElement | null = null;

	/** Binds to the given pane element and toggles the line-numbers CSS class based on preferences. */
	init(pane: HTMLElement): void {
		this.paneElement = pane;

		this.unsub = preferences.subscribe((p) => {
			if (this.paneElement) {
				this.paneElement.classList.toggle('show-line-numbers', p.editorLineNumbers);
			}
		});
	}

	/** Unsubscribes and clears the pane reference. */
	destroy(): void {
		this.unsub?.();
		this.unsub = null;
		this.paneElement = null;
	}
}

export const lineNumbersService = new LineNumbersService();
