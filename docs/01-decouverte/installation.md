# Installation

Cette page explique comment installer MiraMD sur ta machine. Trois systèmes d'exploitation sont supportés : Linux, Windows et macOS. Tu peux soit télécharger un paquet pré-compilé, soit compiler le projet toi-même depuis le code source.

> Statut actuel : seul le paquet Linux `.deb` est testé en production. Les paquets Windows et macOS sont produits par le système de build mais n'ont pas encore été validés sur ces plateformes (à vérifier).

## Linux

### Paquet `.deb` (Debian, Ubuntu, Mint, Pop!\_OS, etc.)

```bash
sudo dpkg -i MiraMD_0.1.0_amd64.deb
```

Si `dpkg` se plaint de dépendances manquantes :

```bash
sudo apt --fix-broken install
```

Ce que le paquet installe :

- **Le [binaire](glossaire.md#binaire-executable)** dans `/usr/bin/miramd` — environ 5 Mo.
- **Une entrée dans le menu d'applications** (`MiraMD.desktop`).
- **Les associations de fichiers** pour `.md`, `.markdown`, `.mmd`, `.mdx`, `.mkd`.
- **Les icônes** dans `/usr/share/icons/`.

Pour faire de MiraMD l'application par défaut pour les fichiers `.md` :

```bash
xdg-mime default MiraMD.desktop text/markdown
```

Désinstallation :

```bash
sudo dpkg -r miramd
```

### Paquet `.rpm` (Fedora, openSUSE, RHEL)

```bash
sudo rpm -i MiraMD-0.1.0-1.x86_64.rpm
```

Désinstallation :

```bash
sudo rpm -e MiraMD
```

### AppImage (toutes distributions)

L'AppImage est un fichier exécutable autonome qui ne nécessite aucune installation système :

```bash
chmod +x MiraMD_0.1.0_amd64.AppImage
./MiraMD_0.1.0_amd64.AppImage
```

Tu peux le déposer où tu veux (par exemple dans `~/Applications/`) et le lancer par double-clic.

### Prérequis Linux : WebKitGTK

[Tauri](glossaire.md#tauri) utilise la [WebView](glossaire.md#webview) du système pour afficher l'interface. Sur Linux, cette WebView est fournie par **[WebKitGTK](glossaire.md#webkitgtk)**, le moteur de rendu open source de la famille WebKit (le même que Safari).

Sur la plupart des distributions modernes, WebKitGTK est déjà installé. Si MiraMD se lance avec une fenêtre vide ou refuse de démarrer :

```bash
# Ubuntu / Debian
sudo apt install libwebkit2gtk-4.1-0

# Fedora
sudo dnf install webkit2gtk4.1

# Arch
sudo pacman -S webkit2gtk-4.1
```

## Windows

Télécharge l'installeur `.msi` ou `.exe` depuis la page des releases du dépôt, double-clique dessus et suis les étapes de l'assistant. L'application apparaît ensuite dans le menu Démarrer.

Sur Windows 10 et 11, la WebView utilisée est **WebView2** (basée sur Edge/Chromium). Elle est déjà présente sur Windows 11, et installée automatiquement par Windows Update sur Windows 10 récent. Si elle manque, l'installeur la téléchargera.

## macOS

Télécharge le fichier `.dmg`, ouvre-le, glisse l'icône MiraMD dans le dossier Applications.

Au premier lancement, macOS peut refuser d'ouvrir l'application parce qu'elle n'est pas signée par un développeur identifié Apple. Pour passer l'avertissement : clic droit sur l'icône MiraMD dans Applications → "Ouvrir" → "Ouvrir" dans la boîte de dialogue. Cette manipulation n'est nécessaire que la première fois.

La WebView utilisée sur macOS est **WKWebView** (le moteur de Safari), incluse de base dans le système.

## Compiler depuis les sources

Si tu veux compiler MiraMD toi-même (par exemple pour bidouiller le code, pour cibler une architecture non-x86, ou par habitude), il te faut deux outils principaux : [Rust](glossaire.md#rust) et [Node.js](glossaire.md#nodejs).

### Prérequis

- **[Rust](glossaire.md#rust) stable** — installé via [rustup](https://rustup.rs/) (recommandé).
- **[Node.js](glossaire.md#nodejs) v20 ou plus récent** — installé via [nvm](https://github.com/nvm-sh/nvm) ou le gestionnaire de paquets de ton système.
- **Les dépendances système de [Tauri](glossaire.md#tauri)** — la liste détaillée est sur [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/).

Sur Ubuntu/Debian, par exemple :

```bash
sudo apt install build-essential curl wget file libssl-dev \
  libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
  libwebkit2gtk-4.1-dev
```

### Étapes

```bash
# 1. Récupérer le code
git clone https://github.com/<utilisateur>/MiraMD.git
cd MiraMD

# 2. Installer les dépendances JavaScript
npm install

# 3. Compiler le binaire et le packaging pour ta plateforme
npm run tauri build
```

La première compilation est longue (15 à 30 minutes selon ta machine) car [Cargo](glossaire.md#cargo) télécharge et compile toutes les dépendances [Rust](glossaire.md#rust). Les compilations suivantes sont incrémentales et bien plus rapides.

À la fin, tu trouveras les paquets dans `src-tauri/target/release/bundle/` :

- `deb/MiraMD_0.1.0_amd64.deb` (Linux Debian/Ubuntu)
- `rpm/MiraMD-0.1.0-1.x86_64.rpm` (Linux Fedora/openSUSE)
- `appimage/MiraMD_0.1.0_amd64.AppImage` (Linux universel)
- `msi/MiraMD_0.1.0_x64_en-US.msi` (Windows, depuis Windows uniquement)
- `dmg/MiraMD_0.1.0_x64.dmg` (macOS, depuis macOS uniquement)

### Mode développement

Pour travailler sur le code avec rechargement à chaud :

```bash
npm run tauri dev
```

Cette commande lance simultanément le serveur [Vite](glossaire.md#vite) (qui sert le frontend [Svelte](glossaire.md#svelte) avec hot reload) et le binaire [Rust](glossaire.md#rust) en mode debug. Toute modification du code Svelte est reflétée dans la fenêtre sans redémarrer ; toute modification du code Rust déclenche une recompilation et un redémarrage automatique.

## Vérifier que ça marche

Lance MiraMD :

- **Linux** — depuis le menu d'applications, ou en tapant `miramd` dans un terminal.
- **Windows** — depuis le menu Démarrer.
- **macOS** — depuis Launchpad ou le dossier Applications.

Tu devrais voir une fenêtre avec une zone d'édition vide. Tape `# Hello MiraMD` puis appuie sur Entrée — la première ligne devient un titre. Si c'est le cas, tout fonctionne.

Pour la suite, va à [`premiere-utilisation.md`](premiere-utilisation.md).

## Pour aller plus loin

- [`premiere-utilisation.md`](premiere-utilisation.md) — premier tour de l'application.
- [`../04-architecture/build-et-packaging.md`](../04-architecture/build-et-packaging.md) — détails sur le pipeline de build.
- [`../06-references/problemes-connus.md`](../06-references/problemes-connus.md) — bugs et limitations connus.
