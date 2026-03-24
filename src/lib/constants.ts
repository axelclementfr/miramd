/** Sidebar width in logical pixels */
export const SIDEBAR_WIDTH = 284;

/** Minimum window width when no file is open */
export const MIN_WIDTH = 480;

/** Minimum window height */
export const MIN_HEIGHT = 555;

/** Minimum window width when a file is open (compact mode) */
export const MIN_WIDTH_WITH_FILE = 320;

/** Minimum window height when a file is open (compact mode) */
export const MIN_HEIGHT_WITH_FILE = 200;

/** Maximum zoom level */
export const MAX_ZOOM = 2.0;

/** Minimum zoom level */
export const MIN_ZOOM = 0.5;

/** Zoom step increment for slider and discrete commands */
export const ZOOM_STEP = 0.1;

/** Zoom step for Ctrl+wheel — same as the slider for a brisk feel like MarkText */
export const ZOOM_STEP_WHEEL = 0.1;

/** Default zoom level */
export const DEFAULT_ZOOM = 1.0;

/** Default auto-save delay in milliseconds */
export const DEFAULT_AUTO_SAVE_DELAY = 5000;

/** Background color map per theme — prevents white flash on resize (WebKitGTK issue) */
export const THEME_BG_MAP: Record<string, string> = {
	dark: '#282828',
	'one-dark': '#282c34',
	'material-dark': '#34393f',
	light: '#ffffff',
	graphite: '#f7f7f7',
	ulysses: '#f3f3f3',
};

/** Default background fallback */
export const DEFAULT_BG = '#282828';
