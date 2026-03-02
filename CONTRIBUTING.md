# Contributing to MiraMD

Thank you for your interest in contributing to MiraMD!

## Prerequisites

- **Node.js** v20+
- **Rust** (stable toolchain)
- **System dependencies** (Linux): WebKitGTK and related libraries
  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libgtk-3-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
  ```

## Development Setup

```bash
# Clone the repository
git clone https://github.com/<your-fork>/MiraMD.git
cd MiraMD

# Install dependencies
npm ci

# Start dev mode (Vite + Tauri with hot reload)
npm run tauri dev
```

## Available Commands

| Command | Description |
|---|---|
| `npm run tauri dev` | Full dev mode: Vite (port 1420) + Rust backend + hot reload |
| `npm run tauri build` | Production build (.deb/.AppImage) |
| `npm run dev` | Vite dev server only (frontend, no Tauri) |
| `npm run build` | Vite production build only (frontend) |
| `npm run check` | TypeScript + Svelte type checking |
| `npm run lint` | Alias for `npm run check` |
| `npm test` | Run all Vitest tests |
| `npm run test:watch` | Run tests in watch mode |

## Code Style

- **Svelte 5 runes**: use `$state`, `$props`, `$effect`, `$derived`
- **TypeScript strict mode** throughout the frontend
- **CSS variables** for theming -- never hardcode colors
- **French is the default language**; all user-facing text goes through `tr('key')` from the i18n store
- **Rust structs**: use `#[serde(rename_all = "camelCase", default)]` on preference structs

## Testing

MiraMD uses [Vitest](https://vitest.dev/) for automated tests.

```bash
npm test            # Run all tests once
npm run test:watch  # Run tests in watch mode during development
```

Tests live in the `tests/` directory:

| Directory | What it covers |
|---|---|
| `tests/stores/` | Editor store (tabs, content, save state), Preferences store |
| `tests/integration/` | Regression tests for previously fixed bugs |

**When fixing a bug**, add a regression test in `tests/integration/regression.test.ts` so it never comes back.

## Before Submitting a PR

1. Run `npm test` and ensure all tests pass.
2. Run `npm run check` and ensure there are **0 errors**.
3. Test your changes manually with `npm run tauri dev`.
4. Verify there are no regressions on existing features.
5. Write a clear description of what your PR does and why.

## PR Process

1. Fork the repository and create a branch from `develop`.
2. Make your changes and ensure all checks pass.
3. Open a pull request against `develop` (or `main` for hotfixes).
4. Fill out the PR template.
5. Wait for review -- a maintainer will review your changes.

## Documentation

MiraMD has a comprehensive documentation in [`docs/`](docs/) covering architecture, features, technical choices, and known issues — ~45 files in 6 numbered subfolders.

**Before contributing**, read at least:
- [`docs/04-architecture/vue-densemble.md`](docs/04-architecture/vue-densemble.md) — the mental model
- [`docs/06-references/audit.md`](docs/06-references/audit.md) — what works, what doesn't, what's the dette
- [`docs/06-references/problemes-connus.md`](docs/06-references/problemes-connus.md) — known bugs to avoid duplicating reports

**When you contribute code, update the relevant doc files.** See [`CLAUDE.md`](CLAUDE.md) § *Documentation Maintenance Policy* for the mapping (which doc to update for which type of change). The same rules apply whether you're a human contributor or using an AI agent.

## Note on Muya

The Muya editor bundle lives in `static/muya/` as a pre-built UMD file. You do not need to rebuild it during development or in CI. For details on how Muya is integrated, see [`docs/04-architecture/integration-muya.md`](docs/04-architecture/integration-muya.md).
