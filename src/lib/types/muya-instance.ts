/** Minimal typed interface for the Muya WYSIWYG editor instance. */
export interface MuyaInstance {
	container: HTMLElement;
	options: Record<string, unknown>;
	getMarkdown(): string;
	setMarkdown(content: string): void;
	undo(): void;
	redo(): void;
	selectAll(): void;
	focus(): void;
	blur(silent?: boolean, force?: boolean): void;
	destroy(): void;
	on(event: string, callback: (...args: unknown[]) => void): void;
	off(event: string, callback: (...args: unknown[]) => void): void;
	setFont(opts: { fontSize: number; lineHeight: number }): void;
	setFocusMode(enabled: boolean): void;
	setOptions(opts: Record<string, unknown>, silent?: boolean): void;
	clearHistory(): void;
	getHistory(): unknown;
	setHistory(history: unknown): void;
	getCursor(): unknown;
}
