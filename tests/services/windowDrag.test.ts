import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { isDragTarget, setupWindowDrag } from '$lib/services/windowDrag';

function el(html: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  return wrapper.firstElementChild as HTMLElement;
}

describe('isDragTarget — interactive elements are NOT draggable', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false for a <button>', () => {
    expect(isDragTarget(el('<button>x</button>'))).toBe(false);
  });

  it('returns false for an <a>', () => {
    expect(isDragTarget(el('<a href="#">x</a>'))).toBe(false);
  });

  it('returns false for an <input>', () => {
    expect(isDragTarget(el('<input type="text" />'))).toBe(false);
  });

  it('returns false for a <textarea>', () => {
    expect(isDragTarget(el('<textarea></textarea>'))).toBe(false);
  });

  it('returns false for a <select>', () => {
    expect(isDragTarget(el('<select><option>x</option></select>'))).toBe(false);
  });

  it('returns false for a <label>', () => {
    expect(isDragTarget(el('<label>x</label>'))).toBe(false);
  });

  it('returns false for contenteditable=true (Muya editor)', () => {
    expect(isDragTarget(el('<div contenteditable="true">x</div>'))).toBe(false);
  });

  it('returns false for contenteditable="" (shorthand)', () => {
    expect(isDragTarget(el('<div contenteditable="">x</div>'))).toBe(false);
  });

  it('returns false for role="tab" (TabBar)', () => {
    expect(isDragTarget(el('<li role="tab">x</li>'))).toBe(false);
  });

  it('returns false for role="separator" (sidebar resize bar)', () => {
    expect(isDragTarget(el('<div role="separator"></div>'))).toBe(false);
  });

  it('returns false for role="option" (FileTreePane opened tab item)', () => {
    expect(isDragTarget(el('<li role="option">file.md</li>'))).toBe(false);
  });

  it('returns false for role="treeitem" (file tree)', () => {
    expect(isDragTarget(el('<div role="treeitem">folder</div>'))).toBe(false);
  });

  it('returns false for role="checkbox"', () => {
    expect(isDragTarget(el('<div role="checkbox" aria-checked="false"></div>'))).toBe(false);
  });

  it('returns false for role="radio"', () => {
    expect(isDragTarget(el('<div role="radio"></div>'))).toBe(false);
  });

  it('returns false for role="switch"', () => {
    expect(isDragTarget(el('<div role="switch" aria-checked="false"></div>'))).toBe(false);
  });

  it('returns false for role="slider"', () => {
    expect(isDragTarget(el('<div role="slider"></div>'))).toBe(false);
  });

  it('returns false for role="spinbutton"', () => {
    expect(isDragTarget(el('<div role="spinbutton"></div>'))).toBe(false);
  });

  it('returns false for role="textbox"', () => {
    expect(isDragTarget(el('<div role="textbox"></div>'))).toBe(false);
  });

  it('returns false for role="menuitemcheckbox"', () => {
    expect(isDragTarget(el('<div role="menuitemcheckbox"></div>'))).toBe(false);
  });

  it('returns false for role="menuitemradio"', () => {
    expect(isDragTarget(el('<div role="menuitemradio"></div>'))).toBe(false);
  });

  it('returns false for .no-drag opt-out class', () => {
    expect(isDragTarget(el('<div class="no-drag"></div>'))).toBe(false);
  });

  it('returns false for [data-no-drag] opt-out attribute', () => {
    expect(isDragTarget(el('<div data-no-drag></div>'))).toBe(false);
  });
});

describe('isDragTarget — non-interactive elements ARE draggable', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns true for a plain <div>', () => {
    expect(isDragTarget(el('<div>x</div>'))).toBe(true);
  });

  it('returns true for a <span>', () => {
    expect(isDragTarget(el('<span>x</span>'))).toBe(true);
  });

  it('returns true for a <header>', () => {
    expect(isDragTarget(el('<header>x</header>'))).toBe(true);
  });

  it('returns true for a <footer> (status bar background)', () => {
    expect(isDragTarget(el('<footer>x</footer>'))).toBe(true);
  });

  it('returns true for a <ul> with no role', () => {
    expect(isDragTarget(el('<ul><li>x</li></ul>'))).toBe(true);
  });
});

describe('isDragTarget — propagation through ancestors', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false when clicking inside a button (e.g. an SVG icon)', () => {
    const btn = el('<button><svg><circle></circle></svg></button>');
    document.body.appendChild(btn);
    const svg = btn.querySelector('circle')!;
    expect(isDragTarget(svg)).toBe(false);
  });

  it('returns false when clicking inside contenteditable', () => {
    const ce = el('<div contenteditable="true"><p>hello</p></div>');
    document.body.appendChild(ce);
    const p = ce.querySelector('p')!;
    expect(isDragTarget(p)).toBe(false);
  });

  it('returns false when clicking inside a .no-drag region', () => {
    const region = el('<div class="no-drag"><span>x</span></div>');
    document.body.appendChild(region);
    const span = region.querySelector('span')!;
    expect(isDragTarget(span)).toBe(false);
  });

  it('returns true when clicking on a non-interactive sibling of interactive elements', () => {
    document.body.innerHTML = '<div id="root"><button>btn</button><div id="empty"></div></div>';
    const empty = document.getElementById('empty')!;
    expect(isDragTarget(empty)).toBe(true);
  });
});

describe('isDragTarget — edge cases', () => {
  it('returns false for null target', () => {
    expect(isDragTarget(null)).toBe(false);
  });

  it('returns false for non-Element EventTarget (e.g. window)', () => {
    expect(isDragTarget(window)).toBe(false);
  });

  it('returns false for Document (covers clicks outside the visible tree)', () => {
    expect(isDragTarget(document)).toBe(false);
  });
});

describe('isDragTarget — real-world MiraMD DOM scenarios', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('does not drag on FileTreePane opened-tab item (li role="option" with embedded close button)', () => {
    const li = el(`
      <li role="option" aria-selected="true" tabindex="0">
        <span>filename.md</span>
        <button class="of-close-btn" aria-label="Close tab">x</button>
      </li>
    `);
    document.body.appendChild(li);
    expect(isDragTarget(li.querySelector('span')!)).toBe(false);
    expect(isDragTarget(li.querySelector('button')!)).toBe(false);
  });

  it('does not drag on TocPane node (div role="button")', () => {
    const div = el('<div class="toc-node" role="button" tabindex="0"><span>Heading</span></div>');
    document.body.appendChild(div);
    expect(isDragTarget(div.querySelector('span')!)).toBe(false);
  });

  it('does not drag on sidebar drag-bar (role="separator")', () => {
    expect(isDragTarget(el('<div class="drag-bar" role="separator" aria-orientation="vertical"></div>'))).toBe(false);
  });

  it('does not drag on WindowResizeEdges (data-no-drag opt-out)', () => {
    expect(isDragTarget(el('<div class="resize-edge top" role="presentation" data-no-drag></div>'))).toBe(false);
    expect(isDragTarget(el('<div class="resize-corner bottom-right" role="presentation" data-no-drag></div>'))).toBe(false);
  });

  it('drags on empty space in sidebar between sections', () => {
    document.body.innerHTML = `
      <div class="side-bar">
        <div class="right-column">
          <div class="right-column-inner">
            <ul><li role="option">file</li></ul>
            <div id="empty-space" style="height:200px"></div>
          </div>
        </div>
      </div>
    `;
    expect(isDragTarget(document.getElementById('empty-space'))).toBe(true);
  });

  it('drags on tab bar empty area (right of new-file button)', () => {
    document.body.innerHTML = `
      <div class="editor-tabs">
        <div class="scrollable-tabs"><ul></ul></div>
        <button class="new-file">+</button>
        <div id="tab-empty" style="flex:1"></div>
      </div>
    `;
    expect(isDragTarget(document.getElementById('tab-empty'))).toBe(true);
  });

  it('does not drag inside the Muya editor (contenteditable)', () => {
    const ed = el('<div class="muya-container"><div contenteditable="true"><p>Hello <em>world</em></p></div></div>');
    document.body.appendChild(ed);
    expect(isDragTarget(ed.querySelector('em'))).toBe(false);
    expect(isDragTarget(ed.querySelector('p'))).toBe(false);
  });

  it('does not drag inside the SourcePane textarea', () => {
    const wrap = el('<div class="source-pane"><textarea>foo</textarea></div>');
    document.body.appendChild(wrap);
    expect(isDragTarget(wrap.querySelector('textarea'))).toBe(false);
  });
});

const startDragging = vi.fn().mockResolvedValue(undefined);
const toggleMaximize = vi.fn().mockResolvedValue(undefined);

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging, toggleMaximize }),
}));

describe('setupWindowDrag — listener behavior (with mocked Tauri)', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="drag-zone" style="width:100px;height:100px"></div>';
    startDragging.mockClear();
    toggleMaximize.mockClear();
    cleanup = setupWindowDrag();
    // Wait for the async dynamic import inside setupWindowDrag to resolve
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    cleanup?.();
  });

  function dispatchMouseDown(target: Element, opts: MouseEventInit = {}) {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, detail: 1, ...opts }));
  }

  it('calls startDragging on left-click on a non-interactive element', async () => {
    dispatchMouseDown(document.getElementById('drag-zone')!);
    await new Promise((r) => setTimeout(r, 0));
    expect(startDragging).toHaveBeenCalledOnce();
    expect(toggleMaximize).not.toHaveBeenCalled();
  });

  it('does NOT call startDragging on right-click (button=2)', async () => {
    dispatchMouseDown(document.getElementById('drag-zone')!, { button: 2 });
    await new Promise((r) => setTimeout(r, 0));
    expect(startDragging).not.toHaveBeenCalled();
  });

  it('does NOT call startDragging on middle-click (button=1)', async () => {
    dispatchMouseDown(document.getElementById('drag-zone')!, { button: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(startDragging).not.toHaveBeenCalled();
  });

  it('calls toggleMaximize on double-click (e.detail === 2)', async () => {
    dispatchMouseDown(document.getElementById('drag-zone')!, { detail: 2 });
    await new Promise((r) => setTimeout(r, 0));
    expect(toggleMaximize).toHaveBeenCalledOnce();
    expect(startDragging).not.toHaveBeenCalled();
  });

  it('does NOT call startDragging when clicking a button (interactive)', async () => {
    document.body.innerHTML = '<button id="btn">click</button>';
    dispatchMouseDown(document.getElementById('btn')!);
    await new Promise((r) => setTimeout(r, 0));
    expect(startDragging).not.toHaveBeenCalled();
  });

  it('does NOT call startDragging when clicking inside Muya (contenteditable)', async () => {
    document.body.innerHTML = '<div contenteditable="true" id="ce"><span id="inner">x</span></div>';
    dispatchMouseDown(document.getElementById('inner')!);
    await new Promise((r) => setTimeout(r, 0));
    expect(startDragging).not.toHaveBeenCalled();
  });

  it('cleanup() removes the listener (no further drag triggered)', async () => {
    cleanup!();
    cleanup = undefined;
    dispatchMouseDown(document.getElementById('drag-zone')!);
    await new Promise((r) => setTimeout(r, 0));
    expect(startDragging).not.toHaveBeenCalled();
  });
});
