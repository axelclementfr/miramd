# Préférences

Tout ce qui se règle dans MiraMD passe par les préférences : thème, polices, comportement de l'éditeur, modes d'affichage, options Markdown, auto-save, zoom. C'est un objet [JSON](https://www.json.org) persisté sur disque, validé côté backend, et synchronisé en temps réel avec l'interface.

## Vue utilisateur

**Ouvrir le panneau.** Deux moyens :

- Raccourci : `Ctrl+,`.
- Cliquer sur l'icône engrenage en bas de la sidebar.

Le panneau s'ouvre dans une modale, organisée en sections cliquables sur la gauche :

- **Thème** — choix parmi 6 thèmes (Light, Dark, One Dark, Graphite, Material Dark, Ulysses). Voir [`themes.md`](themes.md).
- **Général** — langue (8 disponibles, voir [`i18n.md`](i18n.md)), action au démarrage, zoom, fichiers récents, action de la sidebar.
- **Éditeur** — police (famille, taille), interligne, retour à la ligne, vérification orthographique, auto-pairing des caractères, taille de tabulation, fin de ligne, direction du texte, largeur d'éditeur.
- **Vue** — affichage de la barre d'onglets, de la status bar, mode focus / [machine à écrire](modes-affichage.md), numéros de lignes, masquage de scrollbar.
- **Markdown** — caractère de puce de liste, délimiteur de liste numérotée, type de frontmatter, support des notes de bas de page, super/sub script, compatibilité GitLab, activation du HTML brut, etc.

Au total, **plus de 60 préférences** sont exposées.

**Persistance.** Les préférences sont enregistrées dans `~/.config/miramd/preferences.json` (sur Linux ; chemin équivalent [XDG-compliant](https://specifications.freedesktop.org/basedir-spec/) sur macOS et Windows). Un fichier `preferences.json.bak` est écrit avant chaque modification, comme garde-fou en cas de corruption. Si le fichier de config est inaccessible (permissions, disque plein), MiraMD bascule en cascade : `dirs::config_dir()` → `home_dir/.config` → `/tmp/miramd/`.

**Synchronisation immédiate.** Quand tu modifies un réglage, l'effet est visible **instantanément** : changer de thème met à jour les couleurs sans recharger, changer la taille de police regroupe l'éditeur, etc. Les modifications sont aussi enregistrées sur disque dans la foulée.

## Implémentation

**Composants Svelte concernés** :

- `src/lib/components/settings/SettingsModal.svelte` — la modale principale. Gère la navigation entre sections et l'affichage du panneau actif.
- `src/lib/components/settings/ThemeSection.svelte`, `GeneralSection.svelte`, `EditorSection.svelte`, `ViewSection.svelte`, `MarkdownSection.svelte` — une section par catégorie de préférences. Chacune lit le store `preferences` et appelle `preferences.patch({ ... })` à chaque changement.
- `src/routes/+page.svelte` — applique certaines préférences directement au DOM racine au boot et à chaque changement (par exemple `document.documentElement.setAttribute('data-theme', p.theme)` pour le [thème](themes.md), variables CSS `--font-size`, `--line-height`).

**Services concernés** :

- `src/lib/stores/preferences.ts` — le **store** central. Trois méthodes publiques :
  - `load()` — appelle `invoke('load_preferences')` au démarrage et hydrate le store.
  - `save(prefs)` — remplace tout, persiste sur disque (await).
  - `patch(partial)` — fusionne un patch partiel, persiste **fire-and-forget** (le `.catch()` log seulement, ne notifie pas).
- `src/lib/services/shortcuts.ts` — bind `Ctrl+,` à l'ouverture du panneau. Le zoom n'a plus de raccourci clavier dédié : il se règle via `Ctrl+molette`, le slider Settings, ou l'indicateur de la status bar (cf. [`zoom.md`](zoom.md)). `Ctrl+=`, `Ctrl+-`, `Ctrl+0` sont désormais réassignés aux changements de niveau de heading dans l'éditeur.
- `src/lib/services/zoom.ts` — applique le zoom à l'éditeur.
- `src/lib/services/muya.ts` — `applyPreferences(p)` propage tous les réglages d'édition à l'instance [Muya](../01-decouverte/glossaire.md#muya) en cours (taille de police, auto-pairing, options Markdown, etc.).

**Backend Rust impliqué — commandes [IPC](../01-decouverte/glossaire.md#ipc)** :

- `load_preferences() -> Preferences` (`src-tauri/src/preferences.rs`) — lit `~/.config/miramd/preferences.json`, désérialise via [Serde](../01-decouverte/glossaire.md#serde). Si le fichier est manquant ou corrompu, retourne les valeurs par défaut sans crasher.
- `save_preferences(prefs: Preferences) -> ()` — sérialise en JSON, écrit le `.bak` (best-effort), puis écrit le fichier principal de manière atomique.
- `validate_preferences(prefs)` — fonction interne (pas une commande IPC), appelée à la désérialisation : *clamp* 9 champs numériques pour rester dans des bornes saines :
  - `fontSize`, `codeFontSize` : 8-72 px
  - `zoom` : 0.5-3.0
  - `lineHeight` : 1.0-3.0
  - `tabSize` : 1-8
  - `autoSaveDelay` : 1 000-300 000 ms
  - et quelques autres.

**Stores impactés** :

- `preferences` — l'unique store concerné. Toutes les sections du panneau y sont abonnées.
- Effets en cascade : un changement de `theme` met à jour `data-theme` sur `<html>`, ce qui change toutes les variables CSS (cf. [`themes.md`](themes.md)). Un changement de `language` propage via `setLanguage(p.language)` (cf. [`i18n.md`](i18n.md)). Un changement de `fontSize` ou `lineHeight` est propagé à Muya via `MuyaService.applyPreferences(p)`.

**Schéma de migration** : `prefs_version: u32` est déclaré dans la struct Rust (default = 1), prêt à supporter une migration future, mais **aucune migration n'est implémentée pour l'instant**. Si un jour un champ change de format, les utilisateurs perdront silencieusement leurs settings de ce champ.

## Pièges connus

- **Erreur de sauvegarde silencieuse** ⚠️ : `preferences.patch()` appelle `invoke('save_preferences')` en *fire-and-forget*. Le `.catch()` log dans la console mais l'utilisateur n'est pas notifié. Si la sauvegarde échoue (permissions, disque plein), la préférence est appliquée en mémoire mais perdue au prochain redémarrage. Voir [`problemes-connus.md#erreurs-préférences-silencieuses`](../06-references/problemes-connus.md#erreurs-préférences-silencieuses).
- **Backup `.bak` silencieux** : si le `.bak` ne peut pas être écrit, l'écriture principale tente quand même. En cas de corruption, plus de backup. Voir [`problemes-connus.md#backup-bak-silencieux`](../06-references/problemes-connus.md#backup-bak-silencieux).
- **Fallback `/tmp` sans avertissement** : si `~/.config/miramd/` est inaccessible, les préférences partent dans `/tmp/miramd/preferences.json`, qui peut être nettoyé au reboot. L'utilisateur ne le voit pas. Voir [`problemes-connus.md#fallback-tmp-pour-les-préférences`](../06-references/problemes-connus.md#fallback-tmp-pour-les-préférences).
- **Pas de migration de schéma implémentée** : `prefs_version` existe mais n'est jamais lu. À traiter avant le prochain changement breaking. Voir [`problemes-connus.md#migration-de-schéma-préférences-non-implémentée`](../06-references/problemes-connus.md#migration-de-schéma-préférences-non-implémentée).
- **Patch optimiste** : `patch()` met à jour le store **avant** d'attendre la confirmation backend. Si la sauvegarde échoue, l'UI montre l'état attendu mais le disque ne l'a jamais reçu. C'est confortable pour la fluidité mais c'est aussi la source du piège silencieux ci-dessus.

## Pour aller plus loin

- [`04-architecture/vue-densemble.md`](../04-architecture/vue-densemble.md) — où vivent les préférences dans le modèle des trois couches.
- [`04-architecture/backend-rust.md`](../04-architecture/backend-rust.md) — détails sur le module `preferences.rs`, la struct `Preferences`, la cascade de fallbacks, la validation `validate_preferences()`.
- [`themes.md`](themes.md), [`i18n.md`](i18n.md), [`modes-affichage.md`](modes-affichage.md) — fonctionnalités qui consomment des préférences spécifiques.
