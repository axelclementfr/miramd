# Keyboard shortcuts

All shortcuts listed below use `Ctrl` on Linux/Windows and `Cmd` on macOS unless explicitly specified.

## File operations

| Shortcut | Action |
|---|---|
| `Ctrl+N` | New tab (empty document) |
| `Ctrl+O` | Open file (dialog) |
| `Ctrl+S` | Save file |
| `Ctrl+Shift+S` | Save as… |
| `Ctrl+W` | Close current tab |

## Navigation

| Shortcut | Action |
|---|---|
| `Ctrl+F` | Find in document |
| `Enter` (in find bar) | Next match |
| `Shift+Enter` (in find bar) | Previous match |
| `Escape` (in find bar) | Close find bar |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Open settings |

## Editing (works in WYSIWYG and source modes)

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+A` | Select all |
| `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | Cut / Copy / Paste |
| `Ctrl+1` … `Ctrl+6` | Apply heading H1–H6 (WYSIWYG) |
| `Ctrl+0` | Remove heading (WYSIWYG) |

## Zoom

| Shortcut | Action |
|---|---|
| `Ctrl++` / `Ctrl+=` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `Ctrl+Wheel` | Zoom in/out (mouse) |

Zoom affects the editor view only — UI chrome remains constant.

## Sidebar resize (keyboard accessible)

When focus is on the sidebar's right-edge resize handle (reachable with `Tab`):

| Shortcut | Action |
|---|---|
| `←` / `→` | Resize ±10 px |
| `Shift+←` / `Shift+→` | Resize ±50 px |
| `Home` | Snap to minimum width (230 px) |
| `End` | Snap to maximum width (1200 px) |

## Tab context menu

Right-click a tab to access:

- New tab
- Open file / Open folder / Recent files
- Save / Save as
- Duplicate
- Close tab

## Debug panel (advanced)

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+D` | Toggle debug panel (typed log subjects) |

The debug panel surfaces internal logging streams. Useful when filing bug reports — it shows which subjects (`muya`, `prefs`, `split`, etc.) are emitting events.

## Notes

- Inside the WYSIWYG editor, `Ctrl+B` triggers **bold** rather than toggling the sidebar (matching the standard editor convention).
- All other shortcuts are app-level and consistent across modes.
- Future versions may add a Settings panel to customize keybindings — for now they are hardcoded.
