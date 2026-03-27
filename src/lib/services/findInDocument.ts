/**
 * Helpers DOM purs pour la recherche rapide (Ctrl+F) dans le document éditeur.
 * Extrait pour la testabilité — l'orchestration (state, highlight visuel) vit
 * dans FindBar.svelte.
 *
 * Note : on n'utilise PAS de span-wrap dans le DOM Muya — le MutationObserver
 * interne de l'éditeur réagit aux mutations externes et crash l'app. Les
 * matches sont rendus via CSS Custom Highlight API (`CSS.highlights`) qui
 * décore les Ranges sans toucher au DOM. Cf. FindBar.svelte.
 */

/** Échappe les caractères spéciaux regex dans une chaîne utilisateur. */
export function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface MatchPosition {
	/** Index dans la chaîne complète concaténée des text nodes du root. */
	start: number;
	end: number;
}

/**
 * Énumère les positions (start, end) de toutes les occurrences de `query` dans
 * `fullText`. Case-insensitive si `caseSensitive=false` (défaut).
 * Pure : ne touche pas au DOM. Sert à driver la sélection des matches.
 */
export function findMatchPositions(fullText: string, query: string, caseSensitive = false): MatchPosition[] {
	if (!query) return [];
	const flags = caseSensitive ? 'g' : 'gi';
	const re = new RegExp(escapeRegex(query), flags);
	const matches: MatchPosition[] = [];
	for (let m = re.exec(fullText); m !== null; m = re.exec(fullText)) {
		// Avoid infinite loop on zero-width matches (defensive — escapeRegex
		// ne produit pas de pattern zero-width, mais ceinture + bretelles).
		if (m.index === re.lastIndex) re.lastIndex += 1;
		matches.push({ start: m.index, end: m.index + m[0].length });
	}
	return matches;
}

/**
 * Walk les text nodes sous `root` et retourne, pour chaque match dans le texte
 * concaténé, le `Range` DOM correspondant (text node + offsets).
 *
 * Pas de side-effect : c'est à l'appelant de wrap/highlight les ranges.
 * Renvoie [] si query est vide ou si root est null.
 */
export function collectMatchRanges(root: Node | null, query: string, caseSensitive = false): Range[] {
	if (!root || !query) return [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	const offsets: number[] = []; // cumulative offset BEFORE each node
	let total = 0;
	for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
		offsets.push(total);
		nodes.push(n as Text);
		total += (n.textContent || '').length;
	}
	if (nodes.length === 0) return [];

	const fullText = nodes.map((n) => n.textContent || '').join('');
	const positions = findMatchPositions(fullText, query, caseSensitive);

	const ranges: Range[] = [];
	for (const { start, end } of positions) {
		const r = positionsToRange(nodes, offsets, start, end);
		if (r) ranges.push(r);
	}
	return ranges;
}

function positionsToRange(nodes: Text[], offsets: number[], start: number, end: number): Range | null {
	// Find startNode index via the cumulative offsets array
	const startIdx = findNodeIndex(offsets, nodes, start);
	const endIdx = findNodeIndex(offsets, nodes, end - 1);
	if (startIdx < 0 || endIdx < 0) return null;
	const range = document.createRange();
	try {
		range.setStart(nodes[startIdx], start - offsets[startIdx]);
		range.setEnd(nodes[endIdx], end - offsets[endIdx]);
	} catch {
		return null;
	}
	return range;
}

function findNodeIndex(offsets: number[], nodes: Text[], absolutePos: number): number {
	for (let i = 0; i < nodes.length; i++) {
		const nodeStart = offsets[i];
		const nodeEnd = nodeStart + (nodes[i].textContent || '').length;
		if (absolutePos >= nodeStart && absolutePos < nodeEnd) return i;
	}
	// Position au-delà : retombe sur le dernier nœud non vide
	for (let i = nodes.length - 1; i >= 0; i--) {
		if ((nodes[i].textContent || '').length > 0) return i;
	}
	return -1;
}

