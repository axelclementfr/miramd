import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Contract for `src/lib/styles/editor.css`. These rules are load-bearing for
 * the lock-mode CSS shim and the typewriter padding. Removing or weakening
 * them silently regresses two user-visible features:
 *  - lock mode → toolbar/markers leak back in
 *  - typewriter mode → cursor can't reach vertical center on first/last lines
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

describe('editor.css — typewriter mode contract', () => {
  it('adds top padding to .muya-editor under body.typewriter-mode', () => {
    const body = findRuleBody(CSS, 'body.typewriter-mode .muya-editor');
    expect(body).not.toBeNull();
    // The padding makes the first line scrollable into the vertical center.
    // 50vh is "close enough" to half the pane on typical layouts.
    expect(body).toMatch(/padding-top:\s*50vh/);
    expect(body).toMatch(/padding-bottom:\s*50vh/);
  });
});
