import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Contract for `src/lib/styles/editor.css`.
 *
 * Guards two distinct features whose CSS state must NOT regress:
 *
 *  1. Lock mode (`body.muya-readonly`) — these rules are load-bearing for
 *     hiding Muya's float popups and the markdown markers. Their removal
 *     leaks the editor toolbar/markers back into reading mode.
 *
 *  2. Typewriter mode — the JS-driven approach in src/lib/services/
 *     typewriterPadding.ts uses inline styles on the .muya-editor. There
 *     must be NO CSS rule referencing `typewriter-mode` here. The earlier
 *     CSS-driven attempt (`body.typewriter-mode .muya-editor { padding ... }`)
 *     lost a specificity fight against `.wysiwyg-pane > div[contenteditable]
 *     { padding: 20px ... 100px }` AND, combined with WebKitGTK quirks, broke
 *     the user's ability to type. Re-introducing such a rule is the trap.
 */

const CSS = readFileSync(
  resolve(process.cwd(), 'src/lib/styles/editor.css'),
  'utf8'
);

function findRuleBody(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm');
  const m = css.match(re);
  return m ? m[1] : null;
}

describe('editor.css — lock mode contract', () => {
  it('hides every Muya floating popup (.ag-float-wrapper) under body.muya-readonly', () => {
    const body = findRuleBody(CSS, 'body.muya-readonly .ag-float-wrapper');
    expect(body).not.toBeNull();
    expect(body).toMatch(/display:\s*none/);
  });

  it('hides every markdown marker (.ag-remove) under body.muya-readonly', () => {
    const body = findRuleBody(CSS, 'body.muya-readonly .ag-remove');
    expect(body).not.toBeNull();
    expect(body).toMatch(/display:\s*none/);
  });
});

describe('editor.css — typewriter mode contract (JS-driven, no CSS class)', () => {
  it('contains NO `body.typewriter-mode` rule — typewriter is JS-driven, not CSS-driven', () => {
    // The v2 attempt at CSS-driven typewriter padding introduced a rule like:
    //   body.typewriter-mode .muya-editor { padding-top: 50vh; ... }
    // which lost the specificity fight against .wysiwyg-pane > div[contenteditable]
    // and combined with WebKitGTK to break input. Now we use inline styles via
    // src/lib/services/typewriterPadding.ts. This test catches any well-meaning
    // re-introduction of the failed pattern.
    expect(CSS).not.toMatch(/body\.typewriter-mode/);
  });

  it('contains no rule that disables pointer-events on the editor', () => {
    // If a future change adds `.muya-editor { pointer-events: none }` under any
    // typewriter-related state, the user can no longer click into the editor.
    // The original v2 bug was suspected to be related — guard accordingly.
    const editorBlocks = Array.from(CSS.matchAll(/\.muya-editor[^{]*\{([^}]*)\}/g));
    for (const m of editorBlocks) {
      expect(m[1]).not.toMatch(/pointer-events:\s*none/);
    }
  });
});
