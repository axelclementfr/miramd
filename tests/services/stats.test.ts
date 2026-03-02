import { describe, it, expect, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

const { countVisualLines, countSourceLines } = await import('$lib/services/stats');

describe('countVisualLines', () => {
  it('counts non-blank lines', () => {
    expect(countVisualLines('# Title\n\nParagraph one\n\nParagraph two')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(countVisualLines('')).toBe(0);
  });

  it('single line', () => {
    expect(countVisualLines('Hello')).toBe(1);
  });

  it('ignores blank separator lines', () => {
    // Muya produces \n\n between paragraphs
    expect(countVisualLines('Line 1\n\nLine 2\n\nLine 3')).toBe(3);
  });

  it('counts list items correctly', () => {
    expect(countVisualLines('- Item 1\n- Item 2\n- Item 3')).toBe(3);
  });

  it('counts heading + paragraphs', () => {
    expect(countVisualLines('# Title\n\nSome text\n\n## Subtitle\n\nMore text')).toBe(4);
  });

  it('counts code block lines', () => {
    expect(countVisualLines('```\nline 1\nline 2\nline 3\n```')).toBe(5);
  });

  it('handles trailing newlines', () => {
    expect(countVisualLines('Line 1\n\n')).toBe(1);
  });
});

describe('countSourceLines', () => {
  it('counts every newline-separated line', () => {
    expect(countSourceLines('# Title\n\nParagraph one\n\nParagraph two')).toBe(5);
  });

  it('returns 0 for empty string', () => {
    expect(countSourceLines('')).toBe(0);
  });

  it('single line has 1 line', () => {
    expect(countSourceLines('Hello')).toBe(1);
  });

  it('trailing newline adds a line', () => {
    expect(countSourceLines('Hello\n')).toBe(2);
  });
});
