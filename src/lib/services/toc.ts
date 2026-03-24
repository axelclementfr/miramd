import type { TocEntry } from '$lib/types/editor';

const HEADING_REGEX = /^(#{1,6})\s+(.+)/;
const FENCE_OPEN_REGEX = /^\s{0,3}(`{3,}|~{3,})/;
const FRONTMATTER_DELIM_REGEX = /^---\s*$/;

interface FenceState {
	char: '`' | '~';
	minLen: number;
}

function isClosingFence(line: string, fence: FenceState): boolean {
	const trimmed = line.replace(/^ {0,3}/, '');
	let i = 0;
	while (i < trimmed.length && trimmed[i] === fence.char) i++;
	if (i < fence.minLen) return false;
	return /^[ \t]*$/.test(trimmed.slice(i));
}

/**
 * Extract ATX headings (# through ######) from markdown source.
 *
 * Skips false positives:
 *  - Inside fenced code blocks (``` or ~~~ with closing rules per CommonMark)
 *  - Inside YAML frontmatter (delimited by --- at file start)
 *
 * Position is the byte offset of the start of the heading line in the source.
 *
 * If frontmatter is opened (line 0 is `---`) but never closed, returns [] —
 * a defensive choice: an unclosed frontmatter likely means the document is
 * incomplete or the user is mid-edit, and we'd rather show nothing than
 * surface headings from content that's semantically inside the frontmatter.
 */
export function extractHeadings(content: string): TocEntry[] {
	const headings: TocEntry[] = [];
	const lines = content.split('\n');

	// Detect frontmatter end (line index of closing ---, or -1 if no frontmatter)
	let frontmatterEnd = -1;
	if (lines.length > 0 && FRONTMATTER_DELIM_REGEX.test(lines[0])) {
		let closed = false;
		for (let i = 1; i < lines.length; i++) {
			if (FRONTMATTER_DELIM_REGEX.test(lines[i])) {
				frontmatterEnd = i;
				closed = true;
				break;
			}
		}
		if (!closed) return [];
	}

	let pos = 0;
	let fence: FenceState | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Skip frontmatter (opening delimiter, content, closing delimiter)
		if (i <= frontmatterEnd) {
			pos += line.length + 1;
			continue;
		}

		// Inside a fenced code block: only look for the closing fence
		if (fence !== null) {
			if (isClosingFence(line, fence)) fence = null;
			pos += line.length + 1;
			continue;
		}

		// Outside a fence: check if this line opens one
		const fenceMatch = line.match(FENCE_OPEN_REGEX);
		if (fenceMatch) {
			const fenceStr = fenceMatch[1];
			fence = { char: fenceStr[0] as '`' | '~', minLen: fenceStr.length };
			pos += line.length + 1;
			continue;
		}

		// Regular line: check for heading
		const headingMatch = line.match(HEADING_REGEX);
		if (headingMatch) {
			headings.push({
				level: headingMatch[1].length,
				text: headingMatch[2].replace(/\s*#+\s*$/, '').trim(),
				pos,
			});
		}

		pos += line.length + 1;
	}

	return headings;
}
