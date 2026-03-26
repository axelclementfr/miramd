import { dlog } from './debug';

/**
 * Pré-chauffe Prism (le syntax highlighter de Muya) en faisant tokenize un
 * échantillon de chaque langage couramment utilisé. Réduit le freeze "cold"
 * au premier `setMarkdown` sur un fichier contenant des codeblocks (passe de
 * ~250ms à ~130ms sur 58k chars en pratique).
 *
 * Mécanique : à la première rencontre d'un langage, Prism construit son
 * tokenizer (regex compilation, table de patterns). C'est l'opération coûteuse.
 * Tokenize un seul fois → la table est en cache pour tous les usages suivants.
 *
 * Appelé en `requestIdleCallback` après l'init Muya pour ne pas retarder le
 * premier paint visible. No-op si `window.Prism` n'est pas exposé.
 */

const SAMPLES: Record<string, string> = {
	javascript: 'const x = "hello"; // js\nfunction f(a) { return a + 1; }\n',
	typescript: 'const x: string = "hello";\nfunction f(a: number): number { return a + 1; }\n',
	python: 'def f(a):\n    return a + 1\nx = "hello"  # py\n',
	bash: '#!/bin/bash\necho "hello"\nfor i in *.md; do echo $i; done\n',
	rust: 'fn main() {\n    let x = 42;\n    println!("hello {}", x);\n}\n',
	json: '{"key": "value", "num": 42, "list": [1, 2, 3]}',
	yaml: 'key: value\nnested:\n  - item1\n  - item2\n',
	markdown: '# Title\n**bold** *italic* `code`\n- list item\n',
	html: '<div class="x">hello</div>',
	css: '.foo { color: red; background: #fff; }',
	sql: 'SELECT * FROM users WHERE id = 1;',
	go: 'package main\nfunc main() { fmt.Println("hi") }',
};

interface PrismLike {
	languages: Record<string, unknown>;
	tokenize: (text: string, grammar: unknown) => unknown;
}

function getPrism(): PrismLike | null {
	const w = window as unknown as { Prism?: PrismLike };
	return w.Prism ?? null;
}

function warmupPrism(): void {
	const Prism = getPrism();
	if (!Prism) {
		dlog('muya', 'Prism warmup skipped: window.Prism not exposed');
		return;
	}
	const t0 = performance.now();
	let warmed = 0;
	for (const [lang, sample] of Object.entries(SAMPLES)) {
		const grammar = Prism.languages[lang];
		if (!grammar) continue;
		try {
			Prism.tokenize(sample, grammar);
			warmed += 1;
		} catch (e) {
			dlog('muya', `Prism warmup ${lang} failed:`, e);
		}
	}
	const t1 = performance.now();
	dlog('muya', `Prism warmup: ${warmed} langs in ${(t1 - t0).toFixed(1)}ms`);
}

/** Schedule le warmup en idle (no-op si déjà fait). */
let scheduled = false;
export function scheduleWarmup(): void {
	if (scheduled) return;
	scheduled = true;
	type IdleScheduler = (cb: () => void, opts?: { timeout: number }) => number;
	const ric = (window as unknown as { requestIdleCallback?: IdleScheduler }).requestIdleCallback;
	if (typeof ric === 'function') {
		ric(() => warmupPrism(), { timeout: 2000 });
	} else {
		setTimeout(() => warmupPrism(), 500);
	}
}
