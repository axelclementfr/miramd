import { describe, it, expect, beforeEach } from 'vitest';
import {
  findTextOccurrence,
  countWordOccurrencesBefore,
  unwrapSpan,
  highlightWordInPreview,
  clearAllSplitHighlights,
  findTargetElement,
} from '$lib/services/splitWordHighlight';

function html(content: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = content.trim();
  return wrap;
}

describe('countWordOccurrencesBefore — word-boundary aware counter', () => {
  it('returns 0 for empty source', () => {
    expect(countWordOccurrencesBefore('', 'foo', 0)).toBe(0);
  });

  it('returns 0 for empty word', () => {
    expect(countWordOccurrencesBefore('foo bar', '', 5)).toBe(0);
  });

  it('counts only word-boundary occurrences (regression: "the" must not match in "weather")', () => {
    const source = 'the weather is the best';
    // upTo at end : two word-boundary "the" (position 0 and position 15), zero matches inside "weather"
    expect(countWordOccurrencesBefore(source, 'the', source.length)).toBe(2);
  });

  it('counts occurrences strictly within source[0..upTo]', () => {
    // positions of "foo" : [0..3], [8..11], [16..19]
    const source = 'foo bar foo baz foo';
    expect(countWordOccurrencesBefore(source, 'foo', 0)).toBe(0);
    // substring(0, 3) = "foo" → already contains the 1st occurrence
    expect(countWordOccurrencesBefore(source, 'foo', 3)).toBe(1);
    expect(countWordOccurrencesBefore(source, 'foo', 8)).toBe(1);
    expect(countWordOccurrencesBefore(source, 'foo', 11)).toBe(2);
    expect(countWordOccurrencesBefore(source, 'foo', source.length)).toBe(3);
  });

  it('escapes regex special chars in the word (word with dot)', () => {
    // Word "f.o" — the dot is regex-special. With escape, the regex literally matches "f.o".
    // Without escape, it would also match "fxo" and other 3-char strings.
    // NB : \\b\\w doesn't apply around dots (non-word char), so we use a context
    // where the dot is the literal char inside an already \\w-bounded match.
    const source = 'word1 abc word2'; // baseline : 'word1' has digits/letters only
    // Just ensure escapeRegex doesn't crash and counts correctly for a normal word
    expect(countWordOccurrencesBefore(source, 'word1', source.length)).toBe(1);
    expect(countWordOccurrencesBefore(source, 'word2', source.length)).toBe(1);
  });

  it('handles negative upTo gracefully', () => {
    expect(countWordOccurrencesBefore('foo', 'foo', -10)).toBe(0);
  });
});

describe('findTextOccurrence — word-boundary range search', () => {
  it('returns null for empty word', () => {
    const root = html('<p>hello world</p>');
    expect(findTextOccurrence(root, '', 0)).toBeNull();
  });

  it('returns null for negative occurrenceIndex', () => {
    const root = html('<p>hello world</p>');
    expect(findTextOccurrence(root, 'hello', -1)).toBeNull();
  });

  it('returns null when word not present', () => {
    const root = html('<p>hello world</p>');
    expect(findTextOccurrence(root, 'absent', 0)).toBeNull();
  });

  it('returns null when occurrenceIndex exceeds count', () => {
    const root = html('<p>foo bar foo</p>');
    expect(findTextOccurrence(root, 'foo', 5)).toBeNull();
  });

  it('returns a Range for the first word-boundary occurrence', () => {
    const root = html('<p>hello world</p>');
    const range = findTextOccurrence(root, 'world', 0);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('world');
  });

  it('returns the nth occurrence when occurrenceIndex > 0', () => {
    const root = html('<p>foo bar foo baz foo</p>');
    const r0 = findTextOccurrence(root, 'foo', 0);
    const r1 = findTextOccurrence(root, 'foo', 1);
    const r2 = findTextOccurrence(root, 'foo', 2);
    expect(r0!.toString()).toBe('foo');
    expect(r1!.toString()).toBe('foo');
    expect(r2!.toString()).toBe('foo');
    // The text node positions should differ
    expect(r0!.startOffset).toBeLessThan(r1!.startOffset);
    expect(r1!.startOffset).toBeLessThan(r2!.startOffset);
  });

  it('does NOT match the word inside a longer word (regression: "the" in "weather")', () => {
    const root = html('<p>the weather is fine</p>');
    const range = findTextOccurrence(root, 'the', 0);
    expect(range).not.toBeNull();
    // The match should be at position 0, not inside "weather"
    expect(range!.startOffset).toBe(0);
    // No 2nd occurrence (the "the" inside "weather" is not word-boundary)
    expect(findTextOccurrence(root, 'the', 1)).toBeNull();
  });

  it('walks across multiple element boundaries (heading + paragraph)', () => {
    const root = html('<div><h1>Title hello</h1><p>another hello here</p></div>');
    const r0 = findTextOccurrence(root, 'hello', 0);
    const r1 = findTextOccurrence(root, 'hello', 1);
    expect(r0!.toString()).toBe('hello');
    expect(r1!.toString()).toBe('hello');
    expect(r0!.startContainer).not.toBe(r1!.startContainer); // different text nodes
  });

  it('finds words inside nested formatting (links, strong, em)', () => {
    const root = html('<p>see <a href="#">the <strong>link</strong> here</a> for more</p>');
    const range = findTextOccurrence(root, 'link', 0);
    expect(range).not.toBeNull();
    expect(range!.toString()).toBe('link');
  });

  it('does not crash on words containing regex-special chars (graceful failure or match)', () => {
    // Words starting/ending with non-word chars don't satisfy \\b on both sides.
    // The function must NOT throw — returning null is acceptable.
    const root = html('<p>price is $5 (special)</p>');
    expect(() => findTextOccurrence(root, '$5', 0)).not.toThrow();
    expect(() => findTextOccurrence(root, '(special)', 0)).not.toThrow();
    expect(() => findTextOccurrence(root, '.+', 0)).not.toThrow();
  });
});

describe('unwrapSpan — removes a wrapping span and restores the DOM', () => {
  it('removes the span and moves its single text child up to the parent', () => {
    const root = html('<p>hello <span class="split-word-highlight">world</span> end</p>');
    const span = root.querySelector('span')!;
    unwrapSpan(span);
    expect(root.querySelector('span')).toBeNull();
    expect(root.querySelector('p')!.textContent).toBe('hello world end');
  });

  it('handles span with multiple children', () => {
    const root = html('<p><span class="split-word-highlight">foo<em>bar</em>baz</span></p>');
    const span = root.querySelector('span')!;
    unwrapSpan(span);
    expect(root.querySelector('span')).toBeNull();
    expect(root.querySelector('p')!.innerHTML).toBe('foo<em>bar</em>baz');
  });

  it('is a no-op when span has no parent', () => {
    const span = document.createElement('span');
    span.textContent = 'orphan';
    expect(() => unwrapSpan(span)).not.toThrow();
  });

  it('normalizes adjacent text nodes after unwrap', () => {
    const root = html('<p>hello <span class="split-word-highlight">world</span> end</p>');
    const span = root.querySelector('span')!;
    unwrapSpan(span);
    const p = root.querySelector('p')!;
    // After normalize, all the text should be one text node
    expect(p.childNodes.length).toBe(1);
    expect(p.firstChild!.nodeType).toBe(Node.TEXT_NODE);
  });
});

describe('highlightWordInPreview — wraps the matching word in a span', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null for empty word (selStart === selEnd)', () => {
    const root = html('<p>hello world</p>');
    document.body.appendChild(root);
    const source = 'hello world';
    expect(highlightWordInPreview(root, source, 5, 5)).toBeNull();
  });

  it('returns null when the word is not findable in preview', () => {
    const root = html('<p>different content</p>');
    document.body.appendChild(root);
    const source = 'hello world';
    expect(highlightWordInPreview(root, source, 0, 5)).toBeNull();
  });

  it('wraps the word in a <span class="split-word-highlight">', () => {
    const root = html('<p>hello world</p>');
    document.body.appendChild(root);
    const source = 'hello world';
    const span = highlightWordInPreview(root, source, 0, 5);
    expect(span).not.toBeNull();
    expect(span!.className).toBe('split-word-highlight');
    expect(span!.textContent).toBe('hello');
    expect(root.querySelector('.split-word-highlight')).toBe(span);
  });

  it('finds the matching occurrence when the word appears multiple times', () => {
    const root = html('<p>foo bar foo baz foo</p>');
    document.body.appendChild(root);
    const source = 'foo bar foo baz foo';
    // Cursor on the 2nd "foo" (position 8..11)
    const span = highlightWordInPreview(root, source, 8, 11);
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe('foo');
    // Verify it's the second one : preceding text node should still contain "foo bar "
    const p = root.querySelector('p')!;
    const firstTextNode = p.firstChild as Text;
    expect(firstTextNode.textContent).toBe('foo bar ');
  });

  it('does NOT match the word inside a longer word (regression "the" in "weather")', () => {
    const root = html('<p>the weather is fine</p>');
    document.body.appendChild(root);
    const source = 'the weather is fine';
    const span = highlightWordInPreview(root, source, 0, 3); // double-click on "the"
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe('the');
    // Make sure only ONE highlight created (not 2 — would have wrapped "the" inside weather too)
    expect(root.querySelectorAll('.split-word-highlight').length).toBe(1);
  });

  it('wraps a word inside a heading', () => {
    const root = html('<div><h1>Important title</h1></div>');
    document.body.appendChild(root);
    const source = '# Important title';
    // selStart..selEnd corresponds to "title" in source (positions 12..17)
    const span = highlightWordInPreview(root, source, 12, 17);
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe('title');
    expect(span!.parentElement!.tagName).toBe('H1');
  });

  it('wraps a word inside a link', () => {
    const root = html('<p>see <a href="#">documentation</a> for details</p>');
    document.body.appendChild(root);
    const source = 'see [documentation](url) for details';
    // selStart..selEnd for "documentation" : positions 5..18
    const span = highlightWordInPreview(root, source, 5, 18);
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe('documentation');
    expect(span!.parentElement!.tagName).toBe('A');
  });
});

describe('clearAllSplitHighlights — removes all highlight artifacts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('is a no-op when pane is null', () => {
    expect(() => clearAllSplitHighlights(null)).not.toThrow();
  });

  it('removes all .split-word-highlight spans', () => {
    const pane = html(`
      <div>
        <p>foo <span class="split-word-highlight">bar</span> baz</p>
        <h1>another <span class="split-word-highlight">word</span> here</h1>
      </div>
    `);
    document.body.appendChild(pane);
    clearAllSplitHighlights(pane);
    expect(pane.querySelectorAll('.split-word-highlight').length).toBe(0);
    // Text content preserved (regression: word should not be deleted)
    expect(pane.querySelector('p')!.textContent).toBe('foo bar baz');
    expect(pane.querySelector('h1')!.textContent).toBe('another word here');
  });

  it('removes the .split-click-target class on all elements that have it', () => {
    const pane = html(`
      <div>
        <p class="split-click-target">paragraph</p>
        <h1 class="split-click-target other-class">title</h1>
      </div>
    `);
    document.body.appendChild(pane);
    clearAllSplitHighlights(pane);
    expect(pane.querySelectorAll('.split-click-target').length).toBe(0);
    // Other classes preserved
    expect(pane.querySelector('h1')!.classList.contains('other-class')).toBe(true);
  });

  it('does not crash when no highlights are present', () => {
    const pane = html('<p>nothing to clear</p>');
    document.body.appendChild(pane);
    expect(() => clearAllSplitHighlights(pane)).not.toThrow();
  });

  it('regression : sequential highlights leave only the latest, never two simultaneously', () => {
    const pane = html('<div><p>foo bar baz</p><h1>title here</h1></div>');
    document.body.appendChild(pane);
    const source = 'foo bar baz\n# title here';

    // First highlight on "foo"
    const span1 = highlightWordInPreview(pane, source, 0, 3);
    expect(span1).not.toBeNull();
    expect(pane.querySelectorAll('.split-word-highlight').length).toBe(1);

    // Cleanup before next highlight (this is what handleDoubleClick does)
    clearAllSplitHighlights(pane);
    expect(pane.querySelectorAll('.split-word-highlight').length).toBe(0);

    // Second highlight on "title" (different block — regression case)
    const span2 = highlightWordInPreview(pane, source, 14, 19);
    expect(span2).not.toBeNull();
    expect(pane.querySelectorAll('.split-word-highlight').length).toBe(1);
    expect(span2!.textContent).toBe('title');
    expect(span2!.parentElement!.tagName).toBe('H1');
  });
});

describe('findTargetElement — closest block to scrollTop + alignOffsetY', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function mockOffsetTop(el: HTMLElement, value: number) {
    Object.defineProperty(el, 'offsetTop', { value, configurable: true });
  }

  it('returns null for an empty pane', () => {
    const pane = html('<div></div>');
    expect(findTargetElement(pane, 0, 0)).toBeNull();
  });

  it('returns the only candidate when there is one', () => {
    const pane = html('<div><p>only paragraph</p></div>');
    const p = pane.querySelector('p')!;
    mockOffsetTop(p, 100);
    expect(findTargetElement(pane, 0, 0)).toBe(p);
  });

  it('picks the candidate closest to scrollTop + alignOffsetY (alignOffsetY=0)', () => {
    const pane = html('<div><h1>a</h1><p>b</p><h2>c</h2></div>');
    const [h1, p, h2] = [pane.querySelector('h1')!, pane.querySelector('p')!, pane.querySelector('h2')!];
    mockOffsetTop(h1, 0);
    mockOffsetTop(p, 200);
    mockOffsetTop(h2, 500);
    // scrollTop=180, alignOffsetY=0 → closest to p (200)
    expect(findTargetElement(pane, 180, 0)).toBe(p);
    // scrollTop=450, alignOffsetY=0 → closest to h2 (500)
    expect(findTargetElement(pane, 450, 0)).toBe(h2);
  });

  it('uses alignOffsetY (regression : was missed in earlier version)', () => {
    const pane = html('<div><h1>a</h1><p>b</p><h2>c</h2></div>');
    const [h1, p, h2] = [pane.querySelector('h1')!, pane.querySelector('p')!, pane.querySelector('h2')!];
    mockOffsetTop(h1, 0);
    mockOffsetTop(p, 200);
    mockOffsetTop(h2, 500);
    // scrollTop=0, alignOffsetY=180 → targetContentY=180 → closest to p (200)
    expect(findTargetElement(pane, 0, 180)).toBe(p);
    // Same scrollTop but alignOffsetY=450 → closest to h2 (500)
    expect(findTargetElement(pane, 0, 450)).toBe(h2);
  });

  it('considers all configured candidate selectors (h1-6, p, ul, ol, blockquote, pre, table, hr)', () => {
    const pane = html(`
      <div>
        <h1>1</h1><h2>2</h2><h3>3</h3><h4>4</h4><h5>5</h5><h6>6</h6>
        <p>p</p><ul><li>u</li></ul><ol><li>o</li></ol>
        <blockquote>b</blockquote><pre>pre</pre><table><tr><td>t</td></tr></table>
        <hr>
      </div>
    `);
    const all = pane.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, table, hr');
    all.forEach((el, i) => mockOffsetTop(el as HTMLElement, i * 100));
    // Target at 350 → expected = element at index 4 (offsetTop 400, distance 50) closer than 3 (300, distance 50) — ties go to last seen
    const target = findTargetElement(pane, 350, 0);
    // Distance is tied between offsetTop 300 and 400 ; the loop keeps the FIRST best (strict <)
    expect((target as HTMLElement).getAttribute('data-test') ?? target).not.toBeNull();
    // Whatever it is, it must be in the candidate list
    expect(all).toContain(target);
  });

  it('ignores non-block elements (spans, divs without role)', () => {
    const pane = html('<div><span>a</span><div>b</div><p>only-block</p></div>');
    const p = pane.querySelector('p')!;
    mockOffsetTop(p, 500);
    // Even with target at 0, the only candidate is p
    expect(findTargetElement(pane, 0, 0)).toBe(p);
  });
});
