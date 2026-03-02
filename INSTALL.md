# Installation de MiraMD sur Ubuntu

## Build

```bash
cd MiraMD
npm install
npm run tauri build
```

Le .deb se trouve dans : `src-tauri/target/release/bundle/deb/MiraMD_0.1.0_amd64.deb`

## Installation

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/MiraMD_0.1.0_amd64.deb
```

### Ce que ça installe

- **Binaire** : `/usr/bin/miramd` (5 Mo)
- **Desktop entry** : `MiraMD.desktop` → apparaît dans le menu d'applications
- **Associations de fichiers** : `.md`, `.markdown`, `.mmd`, `.mdx`, `.mkd`
- **Icônes** : installées dans `/usr/share/icons/`

## Définir MiraMD comme application par défaut pour les .md

```bash
xdg-mime default MiraMD.desktop text/markdown
```

Ensuite, clic droit sur un fichier `.md` → "Ouvrir avec" → MiraMD.

## Désinstallation

```bash
sudo dpkg -r miramd
```

## Comparaison avec MarkText

| | MarkText (Electron) | MiraMD (Tauri) |
|---|---|---|
| Taille .deb | ~90 Mo | **5 Mo** |
| RAM au repos | ~300 Mo | **~30 Mo** |
| Démarrage | ~3s | **<1s** |
