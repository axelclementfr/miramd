export interface ShortcutHandlers {
	newFile: () => void;
	openFile: () => Promise<void>;
	saveFile: () => Promise<void>;
	closeTab: () => Promise<void>;
	toggleSidebar: () => void;
	openSettings: () => void;
	isSettingsOpen: () => boolean;
}

/**
 * Sets up global keyboard shortcuts (Ctrl+N, Ctrl+O, Ctrl+S, etc.).
 * Editor shortcuts (Ctrl+Z, Ctrl+A, Ctrl+=/-/0 for headings) are handled
 * in MuyaPane directly. App zoom is driven by Ctrl+wheel + slider + status
 * bar, not keyboard.
 * Returns an unsubscribe function to remove the listener.
 */
export function setupKeyboardShortcuts(handlers: ShortcutHandlers): () => void {
	async function handleKeydown(e: KeyboardEvent): Promise<void> {
		if (handlers.isSettingsOpen()) return;

		const mod = e.ctrlKey || e.metaKey;

		if (mod && e.key === 'o') {
			e.preventDefault();
			await handlers.openFile();
		} else if (mod && e.key === 's') {
			e.preventDefault();
			await handlers.saveFile();
		} else if (mod && (e.key === 'n' || e.key === 'N')) {
			e.preventDefault();
			e.stopImmediatePropagation();
			if (!e.repeat) handlers.newFile();
			return;
		} else if (mod && e.key === 'w') {
			e.preventDefault();
			await handlers.closeTab();
		} else if (mod && e.key === 'b') {
			// Only toggle sidebar if editor doesn't have focus
			// Otherwise let Muya handle Ctrl+B for bold
			const editorEl = document.querySelector('[contenteditable="true"]');
			if (!editorEl || !editorEl.contains(document.activeElement)) {
				e.preventDefault();
				handlers.toggleSidebar();
			}
		} else if (mod && e.key === ',') {
			e.preventDefault();
			handlers.openSettings();
		}
	}

	window.addEventListener('keydown', handleKeydown);
	return () => window.removeEventListener('keydown', handleKeydown);
}
