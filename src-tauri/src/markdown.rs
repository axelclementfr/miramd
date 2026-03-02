use comrak::{markdown_to_html, Options};
use crate::error::AppError;

/// Maximum content size for markdown parsing (10 MB)
const MAX_PARSE_SIZE: usize = 10 * 1024 * 1024;

/// Parse Markdown to HTML using comrak (Rust-native, GFM-compatible)
#[tauri::command]
pub fn parse_markdown(content: &str) -> Result<String, AppError> {
    if content.len() > MAX_PARSE_SIZE {
        return Err(AppError::ContentTooLarge(MAX_PARSE_SIZE as u64));
    }
    let mut options = Options::default();

    // GFM extensions (matching MarkText feature set)
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.footnotes = true;
    options.extension.superscript = true;
    options.extension.description_lists = true;
    options.extension.math_dollars = true;
    options.extension.math_code = true;

    // Render options
    options.render.unsafe_ = false; // Sanitized by default
    options.render.github_pre_lang = true;
    options.render.hardbreaks = false;

    Ok(markdown_to_html(content, &options))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_markdown_basic() {
        let html = parse_markdown("# Hello\n\nWorld").unwrap();
        assert!(html.contains("<h1>"));
        assert!(html.contains("Hello"));
        assert!(html.contains("<p>World</p>"));
    }

    #[test]
    fn test_parse_markdown_gfm_table() {
        let html = parse_markdown("| A | B |\n|---|---|\n| 1 | 2 |").unwrap();
        assert!(html.contains("<table>"));
    }

    #[test]
    fn test_parse_markdown_strikethrough() {
        let html = parse_markdown("~~deleted~~").unwrap();
        assert!(html.contains("<del>"));
    }

    #[test]
    fn test_parse_markdown_tasklist() {
        let html = parse_markdown("- [x] Done\n- [ ] Todo").unwrap();
        assert!(html.contains("checked"));
    }

    #[test]
    fn test_parse_markdown_unsafe_html_blocked() {
        let html = parse_markdown("<script>alert('xss')</script>").unwrap();
        assert!(!html.contains("<script>"));
    }

    #[test]
    fn test_parse_markdown_rejects_oversized_content() {
        let huge = "x".repeat(MAX_PARSE_SIZE + 1);
        assert!(parse_markdown(&huge).is_err());
    }

}
