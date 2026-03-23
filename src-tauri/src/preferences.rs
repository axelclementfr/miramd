use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preferences {
    #[serde(default = "default_prefs_version")]
    pub prefs_version: u32,
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub line_height: f64,
    pub auto_save: bool,
    pub auto_save_delay: u64,
    pub word_wrap: bool,
    pub show_line_numbers: bool,
    pub spellcheck: bool,
    pub language: String,
    pub sidebar_visible: bool,
    pub recent_files: Vec<String>,
    // View modes (read_only is per-tab now, no longer a persisted preference)
    pub source_code_mode: bool,
    pub focus_mode: bool,
    pub typewriter_mode: bool,
    #[serde(default)]
    pub typewriter_sounds: bool,
    #[serde(default = "default_typewriter_sounds_volume")]
    pub typewriter_sounds_volume: f64,
    pub show_tab_bar: bool,
    pub show_status_bar: bool,
    pub split_view: bool,
    // Editor settings
    #[serde(default = "default_code_font_family")]
    pub code_font_family: String,
    #[serde(default = "default_code_font_size")]
    pub code_font_size: u32,
    #[serde(default = "default_true")]
    pub code_block_line_numbers: bool,
    #[serde(default)]
    pub editor_line_numbers: bool,
    #[serde(default = "default_tab_size")]
    pub tab_size: u32,
    #[serde(default = "default_end_of_line")]
    pub end_of_line: String,
    #[serde(default = "default_text_direction")]
    pub text_direction: String,
    #[serde(default)]
    pub editor_line_width: String,
    #[serde(default = "default_true")]
    pub trim_unnecessary_code_block_empty_lines: bool,
    #[serde(default = "default_trim_trailing_newline")]
    pub trim_trailing_newline: u32,
    #[serde(default)]
    pub hide_quick_insert_hint: bool,
    #[serde(default)]
    pub hide_link_popup: bool,
    #[serde(default)]
    pub auto_check: bool,
    #[serde(default = "default_true")]
    pub auto_pair_bracket: bool,
    #[serde(default = "default_true")]
    pub auto_pair_markdown_syntax: bool,
    #[serde(default = "default_true")]
    pub auto_pair_quote: bool,
    // Markdown settings
    #[serde(default = "default_true")]
    pub prefer_loose_list_item: bool,
    #[serde(default = "default_bullet_list_marker")]
    pub bullet_list_marker: String,
    #[serde(default = "default_order_list_delimiter")]
    pub order_list_delimiter: String,
    #[serde(default = "default_prefer_heading_style")]
    pub prefer_heading_style: String,
    #[serde(default = "default_list_indentation")]
    pub list_indentation: u32,
    #[serde(default = "default_frontmatter_type")]
    pub frontmatter_type: String,
    #[serde(default)]
    pub super_sub_script: bool,
    #[serde(default)]
    pub footnote: bool,
    #[serde(default = "default_true")]
    pub is_html_enabled: bool,
    #[serde(default)]
    pub is_gitlab_compatibility_enabled: bool,
    #[serde(default = "default_sequence_theme")]
    pub sequence_theme: String,
    #[serde(default = "default_mermaid_theme")]
    pub mermaid_theme: String,
    #[serde(default = "default_vega_theme")]
    pub vega_theme: String,
    // General settings
    #[serde(default = "default_start_up_action")]
    pub start_up_action: String,
    #[serde(default = "default_zoom")]
    pub zoom: f64,
    #[serde(default)]
    pub hide_scrollbar: bool,
    #[serde(default = "default_file_sort_by")]
    pub file_sort_by: String,
    #[serde(default)]
    pub word_wrap_in_toc: bool,
}

/// Current schema version of the on-disk preferences file. Bump whenever
/// a breaking change is made (renamed field, changed semantics) and add a
/// matching step in `migrate_preferences` below.
pub const CURRENT_PREFS_VERSION: u32 = 1;

fn default_prefs_version() -> u32 { CURRENT_PREFS_VERSION }
fn default_true() -> bool { true }
fn default_code_font_family() -> String { "DejaVu Sans Mono".to_string() }
fn default_code_font_size() -> u32 { 14 }
fn default_tab_size() -> u32 { 4 }
fn default_end_of_line() -> String { "default".to_string() }
fn default_text_direction() -> String { "ltr".to_string() }
fn default_trim_trailing_newline() -> u32 { 2 }
fn default_bullet_list_marker() -> String { "-".to_string() }
fn default_order_list_delimiter() -> String { ".".to_string() }
fn default_prefer_heading_style() -> String { "atx".to_string() }
fn default_list_indentation() -> u32 { 1 }
fn default_frontmatter_type() -> String { "-".to_string() }
fn default_sequence_theme() -> String { "hand".to_string() }
fn default_mermaid_theme() -> String { "default".to_string() }
fn default_vega_theme() -> String { "latimes".to_string() }
fn default_start_up_action() -> String { "blank".to_string() }
fn default_zoom() -> f64 { 1.0 }
fn default_typewriter_sounds_volume() -> f64 { 1.0 }
fn default_file_sort_by() -> String { "modified".to_string() }

impl Default for Preferences {
    fn default() -> Self {
        Self {
            prefs_version: default_prefs_version(),
            theme: "dark".to_string(),
            font_family: "'Open Sans', 'Clear Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif".to_string(),
            font_size: 16,
            line_height: 1.6,
            auto_save: false,
            auto_save_delay: 3000,
            word_wrap: true,
            show_line_numbers: false,
            spellcheck: true,
            language: "fr".to_string(),
            sidebar_visible: false,
            recent_files: Vec::new(),
            source_code_mode: false,
            focus_mode: false,
            typewriter_mode: false,
            typewriter_sounds: false,
            typewriter_sounds_volume: default_typewriter_sounds_volume(),
            show_tab_bar: true,
            show_status_bar: true,
            split_view: false,
            // Editor settings
            code_font_family: default_code_font_family(),
            code_font_size: default_code_font_size(),
            code_block_line_numbers: true,
            editor_line_numbers: false,
            tab_size: default_tab_size(),
            end_of_line: default_end_of_line(),
            text_direction: default_text_direction(),
            editor_line_width: String::new(),
            trim_unnecessary_code_block_empty_lines: true,
            trim_trailing_newline: default_trim_trailing_newline(),
            hide_quick_insert_hint: false,
            hide_link_popup: false,
            auto_check: false,
            auto_pair_bracket: true,
            auto_pair_markdown_syntax: true,
            auto_pair_quote: true,
            // Markdown settings
            prefer_loose_list_item: true,
            bullet_list_marker: default_bullet_list_marker(),
            order_list_delimiter: default_order_list_delimiter(),
            prefer_heading_style: default_prefer_heading_style(),
            list_indentation: default_list_indentation(),
            frontmatter_type: default_frontmatter_type(),
            super_sub_script: false,
            footnote: false,
            is_html_enabled: true,
            is_gitlab_compatibility_enabled: false,
            sequence_theme: default_sequence_theme(),
            mermaid_theme: default_mermaid_theme(),
            vega_theme: default_vega_theme(),
            // General settings
            start_up_action: default_start_up_action(),
            zoom: default_zoom(),
            hide_scrollbar: false,
            file_sort_by: default_file_sort_by(),
            word_wrap_in_toc: false,
        }
    }
}

/// Clamp preference values to valid ranges to prevent UI breakage.
fn validate_preferences(prefs: &mut Preferences) {
    prefs.font_size = prefs.font_size.clamp(8, 72);
    prefs.code_font_size = prefs.code_font_size.clamp(8, 72);
    prefs.line_height = prefs.line_height.clamp(1.0, 3.0);
    prefs.zoom = prefs.zoom.clamp(0.5, 3.0);
    prefs.auto_save_delay = prefs.auto_save_delay.clamp(500, 60000);
    prefs.tab_size = prefs.tab_size.clamp(1, 8);
}

/// Warning code emitted when the XDG config dir is unavailable and prefs
/// fall back to /tmp (lost at reboot).
pub const WARN_TMP_FALLBACK: &str = "prefs_tmp_fallback";
/// Warning code emitted when the .bak copy of preferences could not be
/// written before a save (the save itself still succeeds).
pub const WARN_BACKUP_FAILED: &str = "prefs_backup_failed";
/// Warning code emitted when the loaded prefs file was written by a newer
/// version of MiraMD (downgrade scenario). Settings still load best-effort.
pub const WARN_FUTURE_VERSION: &str = "prefs_future_version";

#[derive(Debug, PartialEq, Eq)]
pub enum MigrationResult {
    AlreadyCurrent,
    Migrated { from: u32 },
    FutureVersion { actual: u32 },
}

/// Bring preferences up to the current schema version.
/// Returns the outcome so the caller can decide whether to persist (when
/// migrated) or warn the user (when the file was saved by a newer build).
pub fn migrate_preferences(prefs: &mut Preferences) -> MigrationResult {
    use std::cmp::Ordering;
    match prefs.prefs_version.cmp(&CURRENT_PREFS_VERSION) {
        Ordering::Equal => MigrationResult::AlreadyCurrent,
        Ordering::Less => {
            let from = prefs.prefs_version;
            log::info!("Migrating preferences from v{} to v{}", from, CURRENT_PREFS_VERSION);
            // Future migrations chain here:
            //   if from < 2 { migrate_v1_to_v2(prefs); }
            //   if from < 3 { migrate_v2_to_v3(prefs); }
            prefs.prefs_version = CURRENT_PREFS_VERSION;
            MigrationResult::Migrated { from }
        }
        Ordering::Greater => MigrationResult::FutureVersion { actual: prefs.prefs_version },
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadResult {
    pub prefs: Preferences,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub warnings: Vec<String>,
}

/// Resolve the preferences file path. Returns the path plus any warnings
/// raised during resolution (e.g. /tmp fallback).
fn prefs_path_with_warnings() -> (PathBuf, Vec<String>) {
    let mut warnings = Vec::new();
    let config_dir = dirs::config_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join(".config")))
        .unwrap_or_else(|| {
            log::warn!("Could not determine config directory, using /tmp");
            warnings.push(WARN_TMP_FALLBACK.to_string());
            PathBuf::from("/tmp")
        });
    let dir = config_dir.join("miramd");
    if let Err(e) = fs::create_dir_all(&dir) {
        log::warn!("Failed to create preferences directory: {}", e);
    }
    (dir.join("preferences.json"), warnings)
}

#[tauri::command]
pub fn load_preferences() -> LoadResult {
    let (path, mut warnings) = prefs_path_with_warnings();
    let mut prefs = match fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str::<Preferences>(&content) {
            Ok(p) => p,
            Err(e) => {
                log::warn!("Preferences JSON corrupted, resetting to defaults: {}", e);
                Preferences::default()
            }
        },
        Err(_) => {
            log::info!("No preferences file found, creating defaults");
            let prefs = Preferences::default();
            // Discard warnings here — load_preferences already captured them
            let _ = save_preferences(prefs.clone());
            prefs
        }
    };
    match migrate_preferences(&mut prefs) {
        MigrationResult::Migrated { from: _ } => {
            // Persist immediately so we don't run the migration on every launch.
            let _ = save_preferences(prefs.clone());
        }
        MigrationResult::FutureVersion { actual } => {
            log::warn!(
                "Preferences saved by a newer build (v{}, current is v{}); loading best-effort",
                actual,
                CURRENT_PREFS_VERSION
            );
            warnings.push(WARN_FUTURE_VERSION.to_string());
        }
        MigrationResult::AlreadyCurrent => {}
    }
    validate_preferences(&mut prefs);
    LoadResult { prefs, warnings }
}

#[tauri::command]
pub fn save_preferences(mut prefs: Preferences) -> Result<SaveResult, crate::error::AppError> {
    validate_preferences(&mut prefs);
    // /tmp fallback is reported only by load_preferences; save discards it
    // to avoid a toast on every keystroke-driven save.
    let (path, _) = prefs_path_with_warnings();
    let mut warnings = Vec::new();

    // Backup existing preferences before overwriting
    if path.exists() {
        let backup = path.with_extension("json.bak");
        if let Err(e) = fs::copy(&path, &backup) {
            log::warn!("Failed to backup preferences: {}", e);
            warnings.push(WARN_BACKUP_FAILED.to_string());
        }
    }

    let json = serde_json::to_string_pretty(&prefs)?;
    fs::write(path, json)?;
    Ok(SaveResult { warnings })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_preferences_are_valid() {
        let prefs = Preferences::default();
        assert_eq!(prefs.font_size, 16);
        assert_eq!(prefs.zoom, 1.0);
        assert_eq!(prefs.theme, "dark");
        assert_eq!(prefs.language, "fr");
    }

    #[test]
    fn test_validate_clamps_extreme_values() {
        let mut prefs = Preferences::default();
        prefs.font_size = 0;
        prefs.zoom = 100.0;
        prefs.line_height = 0.1;
        prefs.auto_save_delay = 1;
        prefs.tab_size = 99;

        validate_preferences(&mut prefs);

        assert_eq!(prefs.font_size, 8);
        assert_eq!(prefs.zoom, 3.0);
        assert_eq!(prefs.line_height, 1.0);
        assert_eq!(prefs.auto_save_delay, 500);
        assert_eq!(prefs.tab_size, 8);
    }

    #[test]
    fn test_validate_keeps_normal_values() {
        let mut prefs = Preferences::default();
        let original_font = prefs.font_size;
        let original_zoom = prefs.zoom;

        validate_preferences(&mut prefs);

        assert_eq!(prefs.font_size, original_font);
        assert_eq!(prefs.zoom, original_zoom);
    }

    #[test]
    fn test_serde_roundtrip() {
        let prefs = Preferences::default();
        let json = serde_json::to_string_pretty(&prefs).unwrap();
        let deserialized: Preferences = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.theme, prefs.theme);
        assert_eq!(deserialized.font_size, prefs.font_size);
        assert_eq!(deserialized.zoom, prefs.zoom);
    }

    #[test]
    fn test_serde_missing_fields_use_defaults() {
        let json = r#"{"theme": "light"}"#;
        let prefs: Preferences = serde_json::from_str(json).unwrap();
        assert_eq!(prefs.theme, "light");
        // Other fields should have defaults
        assert_eq!(prefs.font_size, 16);
        assert_eq!(prefs.zoom, 1.0);
    }

    #[test]
    fn test_serde_unknown_fields_ignored() {
        let json = r#"{"theme": "dark", "unknownField": true}"#;
        let result: Result<Preferences, _> = serde_json::from_str(json);
        // Should not fail — unknown fields are silently ignored with serde default
        assert!(result.is_ok());
    }

    #[test]
    fn test_migrate_already_current_is_noop() {
        let mut prefs = Preferences::default();
        // default_prefs_version() returns CURRENT_PREFS_VERSION
        assert_eq!(prefs.prefs_version, CURRENT_PREFS_VERSION);
        let result = migrate_preferences(&mut prefs);
        assert_eq!(result, MigrationResult::AlreadyCurrent);
        assert_eq!(prefs.prefs_version, CURRENT_PREFS_VERSION);
    }

    #[test]
    fn test_migrate_old_version_bumps_to_current() {
        let mut prefs = Preferences::default();
        prefs.prefs_version = 0;
        let result = migrate_preferences(&mut prefs);
        assert_eq!(result, MigrationResult::Migrated { from: 0 });
        assert_eq!(prefs.prefs_version, CURRENT_PREFS_VERSION);
    }

    #[test]
    fn test_migrate_future_version_flagged() {
        let mut prefs = Preferences::default();
        prefs.prefs_version = CURRENT_PREFS_VERSION + 5;
        let result = migrate_preferences(&mut prefs);
        assert_eq!(result, MigrationResult::FutureVersion { actual: CURRENT_PREFS_VERSION + 5 });
        // Should not be touched — we don't know how to "downgrade" a newer file
        assert_eq!(prefs.prefs_version, CURRENT_PREFS_VERSION + 5);
    }

    #[test]
    fn test_default_prefs_version_matches_current() {
        // Guard against drift: the serde default and the migration target
        // must agree, otherwise loading a fresh default would trip the
        // migration loop.
        let prefs = Preferences::default();
        assert_eq!(prefs.prefs_version, CURRENT_PREFS_VERSION);
    }
}
