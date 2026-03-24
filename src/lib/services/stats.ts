import { editor } from '$lib/stores/editor';
import { invoke } from '@tauri-apps/api/core';

/**
 * Count visual lines in markdown content.
 *
 * In WYSIWYG mode, a "line" is what the user sees: each paragraph,
 * heading, list item, blockquote line, table row, or code fence line
 * counts as one visual line. Blank separator lines between blocks
 * are NOT counted.
 *
 * In source mode, every actual newline-separated line counts.
 */
export function countVisualLines(markdown: string): number {
	if (!markdown) return 0;

	const lines = markdown.split('\n');
	let count = 0;

	for (const line of lines) {
		// Skip blank lines (markdown paragraph separators)
		if (line.trim() === '') continue;
		count++;
	}

	return Math.max(count, 0);
}

/** Count raw lines in source code (every \n counts). */
export function countSourceLines(content: string): number {
	if (!content) return 0;
	return content.split('\n').length;
}

/** Update the editor stats from markdown content. */
export function updateStats(markdown: string, sourceMode: boolean): void {
	if (!markdown) {
		editor.stats.set({ words: 0, chars: 0, lines: 0, paragraphs: 0 });
		return;
	}

	const lines = sourceMode ? countSourceLines(markdown) : countVisualLines(markdown);

	// Word count: handle CJK characters as individual words
	const removedChinese = markdown.replace(/[\u4e00-\u9fa5]/g, '');
	const tokens = removedChinese.split(/[\s\n]+/).filter((t) => t);
	const chineseWordCount = markdown.length - removedChinese.length;
	const words = chineseWordCount + tokens.length;

	const chars = markdown.replace(/[\s\n]/g, '').length;
	const paragraphs = markdown.split(/\n{2,}/).filter((p) => p.trim()).length;

	editor.stats.set({ words, chars, lines, paragraphs });
}
