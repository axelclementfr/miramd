import { MIN_HEIGHT, MIN_HEIGHT_WITH_FILE, MIN_WIDTH, MIN_WIDTH_WITH_FILE } from '$lib/constants';
import { editor } from '$lib/stores/editor';

export interface WindowInitResult {
	/** Cleanup all listeners */
	destroy: () => void;
	/** Returns current maximized state */
	isMaximized: () => boolean;
}

/**
 * Initializes window behavior:
 * - Sets min size dynamically based on whether a file is open
 * - Tracks maximized state (for hiding resize edges)
 *
 * @param onMaximizedChange - called when maximized state changes
 */
export async function initWindow(onMaximizedChange: (maximized: boolean) => void): Promise<WindowInitResult> {
	const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
	const win = getCurrentWindow();

	let maximized = await win.isMaximized();
	onMaximizedChange(maximized);

	const unsubs: (() => void)[] = [];

	// Dynamic min size based on whether a file is open
	unsubs.push(
		editor.activeTabId.subscribe(async (id) => {
			try {
				if (id !== null) {
					await win.setMinSize(new LogicalSize(MIN_WIDTH_WITH_FILE, MIN_HEIGHT_WITH_FILE));
				} else {
					await win.setMinSize(new LogicalSize(MIN_WIDTH, MIN_HEIGHT));
				}
			} catch (e) {
				console.debug('[WindowInit] setMinSize:', e);
			}
		}),
	);

	// Track maximized state
	const unlistenResize = await win.onResized(async () => {
		maximized = await win.isMaximized();
		onMaximizedChange(maximized);
	});
	unsubs.push(unlistenResize);

	return {
		destroy: () => unsubs.forEach((u) => u()),
		isMaximized: () => maximized,
	};
}
