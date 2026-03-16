import { describe, it, expect } from 'vitest';
import { extractHeadings } from '$lib/services/toc';

describe('extractHeadings — basic ATX headings', () => {
  it('returns empty array for content without headings', () => {
    expect(extractHeadings('just some text\nwithout headings')).toEqual([]);
  });

  it('extracts a simple H1', () => {
    const out = extractHeadings('# Title');
    expect(out).toEqual([{ level: 1, text: 'Title', pos: 0 }]);
  });

  it('extracts H2 through H6', () => {
    const md = '## Two\n### Three\n#### Four\n##### Five\n###### Six';
    const out = extractHeadings(md);
    expect(out.map((h) => h.level)).toEqual([2, 3, 4, 5, 6]);
  });

  it('rejects 7+ hash characters (not a heading)', () => {
    expect(extractHeadings('####### Seven')).toEqual([]);
  });

  it('rejects # without trailing space', () => {
    expect(extractHeadings('#NoSpace')).toEqual([]);
  });

  it('strips trailing closing hashes from text', () => {
    expect(extractHeadings('# Title #')[0].text).toBe('Title');
    expect(extractHeadings('## Heading ##')[0].text).toBe('Heading');
    expect(extractHeadings('# Title ###  ')[0].text).toBe('Title');
  });

  it('preserves inline hashes inside the title text', () => {
    expect(extractHeadings('# Issue #42 fix')[0].text).toBe('Issue #42 fix');
  });

  it('computes pos as byte offset to the start of the heading line', () => {
    const md = 'first line\nsecond line\n# Heading';
    expect(extractHeadings(md)[0].pos).toBe('first line\nsecond line\n'.length);
  });

  it('extracts multiple consecutive headings', () => {
    const md = '# A\n## B\n### C';
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(['A', 'B', 'C']);
    expect(out.map((h) => h.level)).toEqual([1, 2, 3]);
  });

  it('ignores indented "headings" (4 spaces or tab)', () => {
    expect(extractHeadings('    # not a heading')).toEqual([]);
    expect(extractHeadings('\t# not a heading')).toEqual([]);
  });
});

describe('extractHeadings — fenced code blocks', () => {
  it('skips # lines inside ``` blocks', () => {
    const md = '# Real\n```\n# fake\n```\n## After';
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(['Real', 'After']);
  });

  it('skips # lines inside ~~~ blocks', () => {
    const md = '# Real\n~~~\n# fake\n~~~\n## After';
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(['Real', 'After']);
  });

  it('handles a fenced block with language identifier', () => {
    const md = '# Real\n```python\n# python comment\n```\n## After';
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(['Real', 'After']);
  });

  it('handles longer fences (4+ backticks)', () => {
    const md = '# Real\n````\n# fake\n````\n## After';
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(['Real', 'After']);
  });

  it('does not confuse ``` and ~~~ openers/closers', () => {
    // Open with ```, ~~~ inside should NOT close it
    const md = '```\n~~~\n# still in code\n```\n# Real';
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(['Real']);
  });

  it('treats unclosed fence as code through end of document', () => {
    const md = '# Real\n```\n# fake until EOF';
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(['Real']);
  });
});

describe('extractHeadings — frontmatter', () => {
  it('skips YAML frontmatter at file start', () => {
    const md = '---\ntitle: Foo\n# yaml comment\n---\n# Real Title';
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(['Real Title']);
  });

  it('does not treat --- as frontmatter when not at file start', () => {
    const md = '# Heading\n\n---\n# After hr';
    const out = extractHeadings(md);
    // The "---" here is a thematic break, not frontmatter.
    // Both headings should be extracted.
    expect(out.map((h) => h.text)).toEqual(['Heading', 'After hr']);
  });

  it('handles frontmatter with no inner content', () => {
    const md = '---\n---\n# Title';
    const out = extractHeadings(md);
    expect(out.map((h) => h.text)).toEqual(['Title']);
  });

  it('treats unclosed frontmatter as: ignore everything (defensive)', () => {
    // If someone writes "---" at the start but never closes, treat the whole file as
    // frontmatter. This is what most markdown parsers do.
    const md = '---\nincomplete frontmatter\n# never extracted';
    const out = extractHeadings(md);
    expect(out).toEqual([]);
  });
});

describe('extractHeadings — mixed scenarios', () => {
  it('frontmatter + headings + fenced block + heading', () => {
    const md = [
      '---',
      'title: Test',
      '---',
      '',
      '# Introduction',
      '',
      'Some text.',
      '',
      '```js',
      '// # not a heading',
      'console.log("# also not");',
      '```',
      '',
      '## Conclusion',
    ].join('\n');
    const out = extractHeadings(md);
    expect(out.map((h) => `${h.level}/${h.text}`)).toEqual([
      '1/Introduction',
      '2/Conclusion',
    ]);
  });

  it('positions are correct across mixed content', () => {
    const md = '# A\n```\n# fake\n```\n# B';
    const out = extractHeadings(md);
    expect(out[0].pos).toBe(0);
    expect(out[1].pos).toBe('# A\n```\n# fake\n```\n'.length);
  });
});
