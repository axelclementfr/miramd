# Themes

MiraMD ships with six bundled themes covering light, dark, and high-contrast preferences. Switch them in **Settings → Appearance → Theme** or with the dropdown in the status bar.

## Available themes

| Theme | Mode | Accent | Notes |
|---|---|---|---|
| **Light** | Light | Blue | Clean default light theme, white background |
| **Dark** | Dark | Blue | Standard dark theme, easy on the eyes |
| **One Dark** | Dark | Purple | Inspired by Atom's One Dark |
| **Graphite** | Mixed | Slate | Dark sidebar with a light editor — best of both for focused writing |
| **Material Dark** | Dark | Orange | Material Design palette with vibrant orange accents |
| **Ulysses** | Light | Teal | Clean, paper-like light theme inspired by Ulysses |

## Switching themes

The theme is applied via CSS variables on the `<html>` element, so transitions are instant — no flash of unstyled content, no app restart. Your selection persists across sessions in your preferences file.

## How themes are defined

If you're curious about the technical side: each theme is a set of CSS custom properties (`--bg-primary`, `--accent`, `--text-secondary`, etc.) defined in `src/lib/styles/themes.css` and applied via the `[data-theme="<name>"]` attribute. Components reference these variables rather than hardcoding colors, so the entire UI restyles consistently.

The **Graphite** theme is the most distinctive: it overrides sidebar-specific variables to keep the sidebar dark while the editor stays light. This was a deliberate choice for users who like a focused, contrasted workspace without going fully dark or fully light.

## Custom themes

User-defined themes are not supported in the current version. They are on the list of "maybe later if there is demand" — let us know via [issues](https://github.com/axelclementfr/miramd/issues) if this matters to you.

A workaround for now: clone the repo, edit `themes.css`, build from source. See [Building from source](building.md).
