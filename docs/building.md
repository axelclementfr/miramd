# Building from source

This guide covers building MiraMD locally and producing distributable binaries. Use it if you want to contribute, customize, or just verify the build.

## Prerequisites

All platforms:

- **Rust** stable (≥ 1.75 recommended). Install via [rustup](https://rustup.rs).
- **Node.js** 20+ and **npm**.

### Linux additional dependencies

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libgtk-3-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev
```

On Fedora / Rocky: equivalent packages are `webkit2gtk4.1-devel`, `libappindicator-gtk3-devel`, `librsvg2-devel`, `gtk3-devel`, `libsoup3-devel`, `javascriptcoregtk4.1-devel`.

### Windows additional dependencies

- **Microsoft Visual Studio C++ Build Tools** (or the full Visual Studio with the "Desktop development with C++" workload)
- **WebView2 Runtime** — usually pre-installed on Windows 10/11; otherwise grab it from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### macOS additional dependencies

- **Xcode Command Line Tools**:
  ```bash
  xcode-select --install
  ```

## Clone and install

```bash
git clone https://github.com/axelclementfr/miramd.git
cd miramd
npm install
```

The first `npm install` is slow because Tauri pulls a lot of native deps. Subsequent installs are fast.

## Development build (hot reload)

```bash
npm run tauri dev
```

This starts:
- Vite on `http://localhost:1420` for the SvelteKit frontend
- Cargo running the Rust backend
- The MiraMD window connecting to both

Frontend changes hot-reload instantly. Rust changes trigger a recompile.

If the tray icon stays resident from a previous session and blocks the new instance: right-click the tray → **Quit MiraMD**, then re-run.

## Production build

```bash
npm run tauri build
```

The build runs frontend + backend in release mode and emits installers under `src-tauri/target/release/bundle/`:

| Platform | Output |
|---|---|
| Linux | `bundle/deb/*.deb`, `bundle/appimage/*.AppImage` |
| Windows | `bundle/nsis/*.exe`, `bundle/msi/*.msi` |
| macOS | `bundle/dmg/*.dmg`, `bundle/macos/*.app` |

First build can take 5–15 minutes (cold Rust compile). Subsequent builds are cached.

## Tests and quality checks

```bash
# Frontend unit tests (Vitest)
npm test

# TypeScript + Svelte type check
npm run check

# Biome lint + format
npm run lint

# Rust tests
cd src-tauri && cargo test
```

Continuous integration runs all four on every push (see [.github/workflows/ci.yml](../.github/workflows/ci.yml)).

## Tips and known issues

- **AppImage build sometimes fails** on Tauri 2 due to `linuxdeploy` quirks — this is a known upstream issue, non-blocking (the `.deb` build still succeeds).
- **macOS build only produces ARM64** with default GitHub Actions runners. To build for Intel macOS, you'd need a separate runner with `x86_64-apple-darwin` target.
- **First Rust compile takes a long time**. Use `cargo install sccache` and set `RUSTC_WRAPPER=sccache` for a noticeable speedup on incremental builds.
- The dev command wipes `node_modules/.vite` and `.svelte-kit` before launching to avoid cache drift. If you want to skip this (faster cold start), use `npm run dev:nocache` (frontend only).

## Project layout

```
miramd/
├── src/                  # SvelteKit frontend
│   ├── lib/
│   │   ├── components/   # UI components (.svelte)
│   │   ├── services/     # Pure-logic services (.ts)
│   │   ├── stores/       # Svelte stores
│   │   ├── styles/       # Global CSS + themes
│   │   ├── i18n/         # Translations
│   │   └── types/        # TypeScript type definitions
│   └── routes/           # Top-level pages
├── src-tauri/            # Rust backend
│   ├── src/              # IPC commands, Tauri setup
│   ├── icons/            # App icons (multi-resolution)
│   └── Cargo.toml
├── static/muya/          # Pre-compiled Muya editor
├── tests/                # Vitest tests
└── .github/workflows/    # CI + Release workflows
```
