# Troubleshooting

Common issues and their fixes. If your problem isn't listed, please [open an issue](https://github.com/axelclementfr/miramd/issues) with the platform, version, and any error message.

## Linux

### "Cannot find libwebkit2gtk-4.1.so" on startup

Install the WebKitGTK 4.1 runtime:

```bash
sudo apt-get install libwebkit2gtk-4.1-0
```

On distros that only ship WebKitGTK 4.0, you'll need to build MiraMD from source against the older library or wait for the upstream Tauri release that supports it.

### The app doesn't appear in "Open with…" for `.md` files

The `.deb` package registers MiraMD as a handler for `text/markdown`. If your file manager still doesn't show it:

```bash
sudo update-desktop-database /usr/share/applications/
sudo update-mime-database /usr/share/mime/
```

If you installed via AppImage, you'll need to register it manually — AppImage doesn't write to system locations.

### Tray icon won't go away after closing the window

By design, closing the window hides MiraMD to the system tray rather than quitting (so opening another file is instant). To fully exit: right-click the tray icon → **Quit MiraMD**.

### Dev mode: app launches but no window appears

Check if a previous instance is still running:

```bash
pgrep -fa miramd
```

If yes, `kill -9 <PID>` and re-run `npm run tauri dev`. The single-instance plugin prevents a second window from opening while the first is alive.

## Windows

### SmartScreen blocks the installer

Expected for unsigned builds. Click **More info → Run anyway**. If your IT policy blocks unsigned executables, build from source or wait for code-signed releases (planned).

### Tauri dev mode fails with "WebView2 not found"

Install the [Microsoft WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). Usually pre-installed on Windows 10/11.

### MSI silent install fails

Run the installer with logging to see the cause:

```cmd
msiexec /i MiraMD_<version>_x64_en-US.msi /quiet /l*v miramd-install.log
```

Common issue: missing admin rights. Add `/qb` (basic UI) or run from an elevated command prompt.

## macOS

### "MiraMD is damaged and can't be opened"

This message is misleading — the app isn't damaged, it's just unsigned. Bypass Gatekeeper for it:

```bash
xattr -d com.apple.quarantine /Applications/MiraMD.app
```

Then launch normally. Alternatively, right-click MiraMD.app → **Open** → **Open** the first time.

### Only `.dmg` for Apple Silicon — what about Intel?

The current release only builds for `aarch64-apple-darwin` (M1+). Intel macOS support is planned but not prioritized. If you need it urgently, build from source on an Intel Mac (see [Building](building.md)) or open an issue to track demand.

## All platforms

### Settings reset every launch

Check whether the preferences directory is writable:

- Linux: `~/.config/miramd/`
- Windows: `%APPDATA%\com.axel.miramd\`
- macOS: `~/Library/Application Support/com.axel.miramd/`

If the directory is owned by a different user (typically after running with `sudo` once), `chown` it back to your user.

### Font looks blurry / wrong size on high-DPI screens

`Ctrl+0` resets zoom. `Ctrl+Wheel` adjusts. Your last setting is saved. UI chrome (sidebar, status bar) doesn't zoom — only the editor.

### Editor freezes for ~200 ms when switching between large files

Known issue with the Muya editor's cold-start cost on documents heavy in code blocks or math. The next major version will introduce per-tab Muya instances to eliminate this. For now: keep your most-used files open in tabs rather than reopening from disk.

### How to file a useful bug report

Open the debug panel with `Ctrl+Shift+D`, enable the relevant log subjects, reproduce the issue, copy the log. Attach to the issue along with:

- OS and version
- MiraMD version (shown in the status bar)
- Steps to reproduce
- Expected vs actual

That's enough to triage most issues quickly.
