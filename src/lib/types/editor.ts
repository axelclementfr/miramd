export interface Tab {
	id: string;
	path: string | null;
	name: string;
	content: string;
	savedContent: string;
	isModified: boolean;
	/** Per-tab read-only state. Session-only — not persisted to disk. */
	readOnly?: boolean;
}

export interface DocumentStats {
	words: number;
	chars: number;
	lines: number;
	paragraphs: number;
}

export interface TocEntry {
	level: number;
	text: string;
	pos: number;
}
