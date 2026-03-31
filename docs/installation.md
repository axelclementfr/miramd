# Installation

MiraMD ships pre-built binaries for Linux, Windows, and macOS. Pick the one for your platform from the [latest release](https://github.com/axelclementfr/miramd/releases).

## Linux

### Debian / Ubuntu (`.deb`)

```bash
sudo dpkg -i MiraMD_<version>_amd64.deb
# Resolve any missing dependencies if needed:
sudo apt-get install -f
```

The package installs:
- The `miramd` binary in `/usr/bin/`
- A desktop file at `/usr/share/applications/MiraMD.desktop` so MiraMD shows up in your application launcher and in the "Open with…" menu for `.md` files
- Icon assets in `/usr/share/icons/hicolor/`

After install, MiraMD is registered as a handler for `text/markdown` and `text/x-markdown` MIME types. To set it as the default `.md` editor, right-click any `.md` file → **Open with → Other Application → MiraMD → Set as default**.

### Portable (`.AppImage`)

The AppImage runs without installation:

```bash
chmod +x MiraMD_<version>_amd64.AppImage
./MiraMD_<version>_amd64.AppImage
```

Place it anywhere on your `PATH` to make it easy to invoke. AppImage does not register with your desktop's MIME handlers — for that, use the `.deb`.

### Dependencies

Both packages depend on **WebKitGTK 4.1**. On a standard Ubuntu 22.04+ / Debian 12+ install it is already present. If you see a startup error, install it:

```bash
sudo apt-get install libwebkit2gtk-4.1-0
```

## Windows

Two installer formats are provided:

- **`MiraMD_<version>_x64-setup.exe`** — NSIS installer with a setup wizard. Recommended for most users.
- **`MiraMD_<version>_x64_en-US.msi`** — MSI package, suitable for silent / enterprise installation.

Silent install with MSI:

```cmd
msiexec /i MiraMD_<version>_x64_en-US.msi /quiet
```

Windows SmartScreen may warn about an unrecognized publisher on first launch — this is expected for an unsigned build. Click **More info → Run anyway**.

## macOS

The `.dmg` ships for **Apple Silicon** (M1/M2/M3/M4) only at this time. Intel Macs are not yet supported.

1. Open `MiraMD_<version>_aarch64.dmg`
2. Drag MiraMD.app into your **Applications** folder
3. On first launch, **right-click the app → Open** to bypass Gatekeeper (the build is unsigned)
4. Subsequent launches work normally from Spotlight or Dock

To check the build is genuine, verify the file hash against the SHA256 published in the release notes.

## Verifying the install

After install, launch MiraMD. You should see:

- A window titled **MiraMD** with a sidebar, editor pane, and status bar
- A tray icon in your system tray (Linux/Windows) or menu bar (macOS) — closing the main window hides to tray rather than quitting
- The version number in the status bar matches the release you installed

If the app fails to launch, see [Troubleshooting](troubleshooting.md).
