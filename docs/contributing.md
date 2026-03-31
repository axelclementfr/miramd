# Contributing

MiraMD is a small project maintained in spare time. Contributions are welcome, but please follow the conventions below to keep the codebase consistent.

## Where to start

- **Bug reports**: open an [issue](https://github.com/axelclementfr/miramd/issues) with steps to reproduce, expected vs actual behavior, OS, and MiraMD version. Logs from the debug panel (`Ctrl+Shift+D`) help.
- **Feature requests**: also an issue — describe the use case before proposing implementation. We'd rather discuss intent first than receive a 500-line PR that misses the point.
- **Pull requests**: see [Building from source](building.md) for the dev setup. Small, focused PRs merge faster than sprawling ones.

## Code style

### Frontend (TypeScript + Svelte)

- **Svelte 5 runes** — use `$state`, `$props`, `$effect`, `$derived` (not the legacy reactive `$:` syntax).
- **TypeScript strict mode** — no implicit `any`, no `// @ts-ignore` without a comment explaining why.
- **Formatting** — [Biome](https://biomejs.dev) is the source of truth (`npm run lint`). Tabs for indentation, single quotes for strings, no semicolons in JSX/Svelte template, semicolons in `.ts`.
- **CSS variables** — no hardcoded colors in components. Reference `var(--accent)`, `var(--bg-primary)`, etc. and let `themes.css` decide.
- **Localization** — all user-facing strings go through `tr('key')` from the i18n store. Add the translation to all 8 locale files in `src/lib/i18n/locales/`.

### Backend (Rust)

- **Standard `rustfmt`** — run `cargo fmt` before committing. CI checks formatting.
- **Serde for IPC** — preferences and IPC payloads use `#[serde(rename_all = "camelCase", default)]` so missing fields default cleanly.
- **No panics in user paths** — wrap fallible operations in `Result` and surface errors to the frontend through `invoke` return values.

## Commits

We use **Conventional Commits** with short, terse messages. Examples:

```
feat: ctrl+f find bar
fix: scrollbar hitbox vs resize edges
refactor: trim dead exports
test: cover stores and context menu
docs: refresh installation guide
chore: bump dependencies
```

Avoid long bodies. The commit message is a *what*, not a story.

## Pull request checklist

Before opening a PR:

- [ ] `npm test` passes
- [ ] `npm run check` passes (0 TS errors)
- [ ] `npm run lint` passes (Biome formatting)
- [ ] `cargo test` passes (if you touched Rust)
- [ ] You manually tested the feature in `npm run tauri dev`
- [ ] You updated the docs if user-facing behavior changed

CI will run all the above on push. PRs with failing CI may not get reviewed until the build is green.

## Architecture notes

- **Tauri commands** (Rust → frontend bridge) live in [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs). Each command is a `#[tauri::command]` function.
- **Frontend IPC** uses `invoke('command_name', { args })` from `@tauri-apps/api/core`. We wrap user-blocking calls in [`invokeWithTimeout`](../src/lib/services/ipc.ts) so a hung Rust command doesn't freeze the UI silently.
- **Pure logic** goes in `src/lib/services/*.ts` so it can be unit-tested in JSDOM without mounting components. Examples: `findInDocument.ts`, `tabWheelScroll.ts`, `recentFiles.ts`.
- **Svelte stores** in `src/lib/stores/` hold app state. Some (`preferences`) sync to Rust on change.
- **Muya** is a pre-compiled black box in `static/muya/`. We wrap it in [`muya.ts`](../src/lib/services/muya.ts) and avoid mutating its DOM externally (its internal `MutationObserver` will fight us).

## License

By contributing, you agree your contributions are licensed under the project's [MIT License](../LICENSE).
