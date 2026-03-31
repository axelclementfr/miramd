# Features

This page is an overview of what MiraMD can do. For exhaustive details on individual features, follow the cross-links throughout.

## Editing modes

MiraMD offers three editing modes that you can switch between freely:

### WYSIWYG (default)

The default mode renders Markdown in real time as you type, similar to Typora or MarkText. Headings appear sized, bold and italic are styled in place, code blocks are syntax-highlighted, and tables, lists, and quotes look like the final output.

This mode is powered by the **Muya** editor (the same engine MarkText uses).

### Source mode

A pure-text Markdown editor with syntax highlighting. Useful when you want to see and edit the raw Markdown — for instance to fix a stubborn formatting issue, or work with complex inline HTML.

Toggle via the status bar button or by editing a `.txt` file (which is automatically locked to source mode, because rendering plain text as Markdown rarely makes sense).

### Split view

Side-by-side layout: source on the left, live preview on the right. Scroll is synchronized between the two panes, anchored on the nearest heading. Double-click a word in the preview to highlight the matching word in the source.

Split view requires source mode to be enabled — the preview pane mirrors what the source pane parses.

## File handling

- **Tabs**: open multiple files in one window. Middle-click a tab to close, drag to reorder, right-click for the context menu.
- **Recent files**: the menu remembers your last 10 opened files. Available via the sidebar context menu and the **File → Recent** submenu.
- **Drag and drop**: drop `.md`, `.markdown`, `.mmd`, `.mdx`, `.mkd`, or `.txt` files anywhere on the window. A full-screen overlay confirms the drop target.
- **Auto-save** (optional): when enabled, changes are persisted to disk after a few seconds of inactivity. See [Settings](#settings).
- **Unsaved changes guard**: closing a tab or the window prompts to save when there are unsaved edits.

## Search

### Find in document (`Ctrl+F`)

Press `Ctrl+F` to open a find bar in the top-right corner. It works in all three editing modes:

- **WYSIWYG**: matches are highlighted in yellow with the active match in orange. Uses the CSS Custom Highlight API for non-destructive decoration.
- **Source**: matches are shown as a yellow overlay aligned with the text. The active match is the native browser selection.
- **Navigation**: `Enter` jumps to the next match, `Shift+Enter` to the previous, `Escape` closes.

### Search across the project

Open the **Search** panel in the sidebar to search the contents of all files in your opened folder. Click a result to jump to the file and line.

## Sidebar

The left sidebar provides three panels:

- **Files**: tree view of the currently opened folder and a list of opened tabs. Right-click any file or the panel header for context menu actions (open folder, new tab, recent files, etc.).
- **Search**: search across files in the opened folder.
- **TOC**: extracted table of contents from the active document headings. Click a heading to jump to it (works in all three editing modes).

Resize the sidebar by dragging its right edge, or using the keyboard: `Tab` to the resize handle, then `←`/`→` (or `Shift+←/→` for larger steps, `Home`/`End` for min/max).

## Tabs

The tab bar above the editor displays your open files. Features:

- Click to switch, middle-click or `Ctrl+W` to close
- Right-click for: New tab, Duplicate, Close
- **Wheel scroll** to navigate across many tabs (works on the tab bar AND the status bar)
- An unsaved file shows a colored dot

## Status bar

The bottom bar shows document statistics (word count, character count, lines, paragraphs), the current editing mode, zoom level, file path, and a few mode toggles. Wheel-scroll over it horizontally to access overflow content.

## Themes

Six bundled themes: **Light**, **Dark**, **One Dark**, **Graphite**, **Material Dark**, **Ulysses**. Switch via Settings → Appearance. Theme variants apply consistently across the editor, sidebar, and chrome.

See [Themes](themes.md) for previews and details.

## Languages

User interface is available in 8 languages: French (default), English, Spanish, German, Italian, Portuguese, Japanese, Chinese. Switch via Settings → General → Language.

## Settings

Open with `Ctrl+,`. Settings are saved to `~/.config/miramd/preferences.json` on Linux (similar paths on Windows and macOS). Key options:

- **General**: language, default editing mode, auto-save, file sort order
- **Appearance / View**: theme, font family, font size, hide/show sidebar, tab bar, status bar, scrollbar
- **Editor**: typewriter mode, focus mode, source mode, split view
- **Debug**: typed debug logs by subject (advanced)

## What's NOT included (yet)

Honest list of things MiraMD doesn't do today:

- **No cloud sync**. Files stay on disk where you put them.
- **No collaborative editing**. Local-first only.
- **No plugin system**. Themes and language packs are bundled.
- **No PDF export**. Use your browser's "Print → Save as PDF" on the rendered preview for now.
- **Limited file types**. Markdown variants and plain text. Not a general text editor.

These are reasonable directions for future versions but they are not the focus right now.
