import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Layout contract for src/routes/+page.svelte.
 *
 * The CSS rules in +page.svelte's <style> block are load-bearing for the
 * entire app shell (sidebar + editor-middle + status bar). Removing or
 * subtly altering them silently breaks the layout — sidebar collapses,
 * editor area shrinks to its content, status bar floats mid-screen.
 *
 * This contract test reads the source file directly and asserts that each
 * critical class is present with its key properties. It catches CODE
 * regressions (someone deleting/renaming/changing a rule). It does NOT
 * catch Vite HMR runtime-state corruption — that requires a dev-server
 * restart and is documented in problems/dev-environment.md.
 */

const PAGE_SVELTE = readFileSync(
  resolve(process.cwd(), 'src/routes/+page.svelte'),
  'utf8'
);

function extractStyleBlock(source: string): string {
  const match = source.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!match) throw new Error('No <style> block in +page.svelte');
  return match[1];
}

function findRuleBody(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the rule even if comments/whitespace precede it; require it's at
  // top-level (line start or after a closing brace), not nested inside another rule.
  const re = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm');
  const match = css.match(re);
  return match ? match[1] : null;
}

const css = extractStyleBlock(PAGE_SVELTE);
const template = PAGE_SVELTE.split('<style')[0];

describe('+page.svelte layout contract', () => {
  describe('.editor-container — root flex container', () => {
    const body = findRuleBody(css, '.editor-container');

    it('rule exists', () => {
      expect(body).not.toBeNull();
    });

    it('display: flex (sidebar + editor align horizontally)', () => {
      expect(body).toMatch(/display:\s*flex/);
    });

    it('flex-direction: row', () => {
      expect(body).toMatch(/flex-direction:\s*row/);
    });

    it('position: absolute + 100vw width + 100vh height (fills viewport)', () => {
      expect(body).toMatch(/position:\s*absolute/);
      expect(body).toMatch(/width:\s*100vw/);
      expect(body).toMatch(/height:\s*100vh/);
    });
  });

  describe('.editor-middle — column flex next to sidebar', () => {
    const body = findRuleBody(css, '.editor-middle');

    it('rule exists', () => {
      expect(body).not.toBeNull();
    });

    it('display: flex with column direction', () => {
      expect(body).toMatch(/display:\s*flex/);
      expect(body).toMatch(/flex-direction:\s*column/);
    });

    it('flex: 1 (fills horizontal space)', () => {
      expect(body).toMatch(/flex:\s*1/);
    });

    it('min-height: 100vh (so the column always covers the viewport)', () => {
      expect(body).toMatch(/min-height:\s*100vh/);
    });

    it('min-width: 0 (prevents flex children from forcing horizontal overflow)', () => {
      expect(body).toMatch(/min-width:\s*0/);
    });
  });

  describe('.sidebar-wrapper — sidebar host', () => {
    const body = findRuleBody(css, '.sidebar-wrapper');

    it('rule exists', () => {
      expect(body).not.toBeNull();
    });

    it('flex-shrink: 0 (sidebar never shrinks below its width)', () => {
      expect(body).toMatch(/flex-shrink:\s*0/);
    });

    it('height: 100% (full editor-container height)', () => {
      expect(body).toMatch(/height:\s*100%/);
    });

    it('overflow: hidden (sidebar internals scroll, not the wrapper)', () => {
      expect(body).toMatch(/overflow:\s*hidden/);
    });
  });

  describe('.editor-tabs-wrapper — TabBar slot', () => {
    const body = findRuleBody(css, '.editor-tabs-wrapper');

    it('rule exists', () => {
      expect(body).not.toBeNull();
    });

    it('flex-shrink: 0 (tab bar keeps its height regardless of editor size)', () => {
      expect(body).toMatch(/flex-shrink:\s*0/);
    });
  });

  describe('.editor-area — active editor pane host', () => {
    const body = findRuleBody(css, '.editor-area');

    it('rule exists', () => {
      expect(body).not.toBeNull();
    });

    it('flex: 1 (fills remaining vertical space in editor-middle)', () => {
      expect(body).toMatch(/flex:\s*1/);
    });

    it('display: flex (so its child EditorContainer can flex)', () => {
      expect(body).toMatch(/display:\s*flex/);
    });

    it('overflow: hidden (scroll happens in muya-pane, not here)', () => {
      expect(body).toMatch(/overflow:\s*hidden/);
    });
  });

  describe('Template ↔ CSS coherence', () => {
    it('every top-level CSS class selector matches an element in the template', () => {
      const selectorMatches = Array.from(css.matchAll(/(?:^|\})\s*\.([a-z][a-z0-9-]*)\s*\{/gm));
      const classNames = Array.from(new Set(selectorMatches.map((m) => m[1])));
      expect(classNames.length).toBeGreaterThan(0);
      for (const cls of classNames) {
        const used = new RegExp(`class="[^"]*\\b${cls}\\b`).test(template);
        expect(used, `class \`.${cls}\` is defined in <style> but no template element uses it`).toBe(true);
      }
    });

    it('the root <div class="editor-container"> wraps everything', () => {
      // Match any whitespace/attributes before the closing >
      expect(template).toMatch(/<div\s+class="editor-container"\s*>/);
    });
  });
});
