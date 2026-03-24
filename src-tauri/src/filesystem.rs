use crate::error::AppError;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

/// Maximum file size for reading (50 MB)
const MAX_READ_SIZE: u64 = 50 * 1024 * 1024;

#[derive(serde::Serialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub content: String,
    pub size: u64,
}

/// Canonicalize and validate a path, rejecting path traversal attempts.
/// Returns the canonical absolute path.
fn sanitize_path(path: &str) -> Result<PathBuf, AppError> {
    let path_buf = PathBuf::from(path);

    // Reject paths containing traversal components in the original input
    for component in path_buf.components() {
        if let std::path::Component::ParentDir = component {
            return Err(AppError::PathTraversal(path.to_string()));
        }
    }

    // Resolve to absolute, following symlinks
    let canonical = path_buf.canonicalize()?;
    Ok(canonical)
}

/// Validate a path for writing (parent must exist, no traversal).
/// Returns the canonical parent joined with the filename to prevent symlink attacks.
fn sanitize_write_path(path: &str) -> Result<PathBuf, AppError> {
    let path_buf = PathBuf::from(path);

    // Reject paths containing traversal components
    for component in path_buf.components() {
        if let std::path::Component::ParentDir = component {
            return Err(AppError::PathTraversal(path.to_string()));
        }
    }

    let file_name = path_buf
        .file_name()
        .ok_or_else(|| AppError::InvalidPath("no filename".to_string()))?;

    // For writes, the file may not exist yet, but parent dir must
    let parent = path_buf
        .parent()
        .ok_or_else(|| AppError::InvalidPath("no parent directory".to_string()))?;

    // Canonicalize the parent and join with filename to prevent symlink attacks
    let canonical_parent = parent.canonicalize()?;
    Ok(canonical_parent.join(file_name))
}

/// Read a Markdown file from disk
#[tauri::command]
pub fn read_file(path: &str) -> Result<FileInfo, AppError> {
    let path_buf = sanitize_path(path)?;

    let name = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    log::info!("read_file: {}", name);

    // Check file size before reading to prevent memory exhaustion
    let metadata = fs::metadata(&path_buf)?;
    if metadata.len() > MAX_READ_SIZE {
        return Err(AppError::ContentTooLarge(MAX_READ_SIZE));
    }

    let content = fs::read_to_string(&path_buf)?;

    Ok(FileInfo {
        path: path_buf.to_string_lossy().to_string(),
        name,
        content,
        size: metadata.len(),
    })
}

/// Write content to a file
#[tauri::command]
pub fn write_file(path: &str, content: &str) -> Result<(), AppError> {
    let path_buf = sanitize_write_path(path)?;
    let name = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    log::info!("write_file: {}", name);
    fs::write(&path_buf, content)?;
    Ok(())
}

/// Create a new untitled file
#[tauri::command]
pub fn create_file(dir: &str, name: &str) -> Result<String, AppError> {
    // Reject path separators, traversal, control characters, and null bytes
    if name.contains('/')
        || name.contains('\\')
        || name == ".."
        || name == "."
        || name.contains('\0')
        || name.chars().any(|c| c.is_control())
    {
        return Err(AppError::InvalidFilename(name.to_string()));
    }

    let dir_path = sanitize_path(dir)?;
    let path = dir_path.join(name);

    // Atomic create: fails if file already exists (prevents TOCTOU race)
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::AlreadyExists {
                AppError::AlreadyExists(path.to_string_lossy().to_string())
            } else {
                AppError::Io(e)
            }
        })?
        .write_all(b"")?;

    Ok(path.to_string_lossy().to_string())
}

/// List all files in a directory (like MarkText — shows everything, not just .md)
/// Supports optional pagination via `offset` and `limit`.
/// When both are None, returns all entries (backwards compatible).
#[tauri::command]
pub fn list_directory_entries(
    dir: &str,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<DirectoryListing, AppError> {
    let dir_path = sanitize_path(dir)?;

    let mut files = Vec::new();
    let entries = fs::read_dir(&dir_path)?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/folders (starting with .)
        if name.starts_with('.') {
            continue;
        }

        let metadata = entry.metadata().ok();
        files.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
            is_dir: path.is_dir(),
        });
    }

    files.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    let total = files.len();

    // Apply pagination if provided
    let entries = match (offset, limit) {
        (Some(off), Some(lim)) => files.into_iter().skip(off).take(lim).collect(),
        (Some(off), None) => files.into_iter().skip(off).collect(),
        (None, Some(lim)) => files.into_iter().take(lim).collect(),
        (None, None) => files,
    };

    Ok(DirectoryListing { entries, total })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    pub entries: Vec<FileEntry>,
    pub total: usize,
}

#[derive(serde::Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_sanitize_path_rejects_traversal() {
        let result = sanitize_path("/tmp/../etc/passwd");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::PathTraversal(_)));
    }

    #[test]
    fn test_sanitize_path_accepts_valid_path() {
        // /tmp always exists on Linux
        let result = sanitize_path("/tmp");
        assert!(result.is_ok());
    }

    #[test]
    fn test_sanitize_write_path_rejects_traversal() {
        let result = sanitize_write_path("/tmp/../etc/shadow");
        assert!(result.is_err());
    }

    #[test]
    fn test_create_file_rejects_path_in_name() {
        let result = create_file("/tmp", "../evil.md");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::InvalidFilename(_)));
    }

    #[test]
    fn test_create_file_rejects_slash_in_name() {
        let result = create_file("/tmp", "sub/evil.md");
        assert!(result.is_err());
    }

    #[test]
    fn test_read_write_roundtrip() {
        let dir = std::env::temp_dir().join("miramd_test_fs");
        fs::create_dir_all(&dir).unwrap();
        let file_path = dir.join("test_roundtrip.md");
        let path_str = file_path.to_string_lossy().to_string();

        // Write
        write_file(&path_str, "# Hello\n\nWorld").unwrap();

        // Read
        let info = read_file(&path_str).unwrap();
        assert_eq!(info.content, "# Hello\n\nWorld");
        assert_eq!(info.name, "test_roundtrip.md");
        assert!(info.size > 0);

        // Cleanup
        fs::remove_file(&file_path).ok();
        fs::remove_dir(&dir).ok();
    }

    #[test]
    fn test_list_directory_entries_skips_hidden() {
        let dir = std::env::temp_dir().join("miramd_test_list");
        fs::create_dir_all(&dir).unwrap();

        // Create visible and hidden files
        fs::write(dir.join("readme.md"), "").unwrap();
        fs::write(dir.join(".hidden"), "").unwrap();

        let listing = list_directory_entries(&dir.to_string_lossy(), None, None).unwrap();
        assert!(listing.entries.iter().any(|f| f.name == "readme.md"));
        assert!(!listing.entries.iter().any(|f| f.name == ".hidden"));
        assert!(listing.total >= 1);

        // Cleanup
        fs::remove_file(dir.join("readme.md")).ok();
        fs::remove_file(dir.join(".hidden")).ok();
        fs::remove_dir(&dir).ok();
    }

    #[test]
    fn test_list_directory_entries_pagination() {
        let dir = std::env::temp_dir().join("miramd_test_pagination");
        fs::create_dir_all(&dir).unwrap();

        // Create 5 files
        for i in 0..5 {
            fs::write(dir.join(format!("file_{}.md", i)), "").unwrap();
        }

        // No pagination — returns all
        let all = list_directory_entries(&dir.to_string_lossy(), None, None).unwrap();
        assert_eq!(all.total, 5);
        assert_eq!(all.entries.len(), 5);

        // Limit only
        let limited = list_directory_entries(&dir.to_string_lossy(), None, Some(2)).unwrap();
        assert_eq!(limited.total, 5);
        assert_eq!(limited.entries.len(), 2);

        // Offset + limit
        let page = list_directory_entries(&dir.to_string_lossy(), Some(3), Some(10)).unwrap();
        assert_eq!(page.total, 5);
        assert_eq!(page.entries.len(), 2); // only 2 remaining after offset 3

        // Offset beyond total
        let empty = list_directory_entries(&dir.to_string_lossy(), Some(100), None).unwrap();
        assert_eq!(empty.total, 5);
        assert_eq!(empty.entries.len(), 0);

        // Cleanup
        for i in 0..5 {
            fs::remove_file(dir.join(format!("file_{}.md", i))).ok();
        }
        fs::remove_dir(&dir).ok();
    }

    #[test]
    fn test_create_file_rejects_null_byte() {
        let result = create_file("/tmp", "evil\0.md");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::InvalidFilename(_)));
    }

    #[test]
    fn test_create_file_rejects_control_chars() {
        let result = create_file("/tmp", "evil\x01.md");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::InvalidFilename(_)));
    }

    #[test]
    fn test_create_file_rejects_backslash() {
        let result = create_file("/tmp", "sub\\evil.md");
        assert!(result.is_err());
    }

    #[test]
    fn test_create_file_atomic_no_overwrite() {
        let dir = std::env::temp_dir().join("miramd_test_atomic");
        fs::create_dir_all(&dir).unwrap();
        let file_path = dir.join("existing.md");
        fs::write(&file_path, "original content").unwrap();

        // Attempting to create_file should fail since file already exists
        let result = create_file(&dir.to_string_lossy(), "existing.md");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::AlreadyExists(_)));

        // Original content must be preserved
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "original content");

        // Cleanup
        fs::remove_file(&file_path).ok();
        fs::remove_dir(&dir).ok();
    }

    #[test]
    fn test_sanitize_write_path_returns_canonical() {
        // Create a temp dir and verify the returned path is fully canonical
        let dir = std::env::temp_dir().join("miramd_test_canonical");
        fs::create_dir_all(&dir).unwrap();

        let test_path = format!("{}/test_write.md", dir.to_string_lossy());
        let result = sanitize_write_path(&test_path).unwrap();

        // The result should be an absolute path under the canonical temp dir
        assert!(result.is_absolute());
        assert_eq!(result.file_name().unwrap(), "test_write.md");

        // Cleanup
        fs::remove_dir(&dir).ok();
    }

    #[test]
    fn test_sanitize_path_rejects_nonexistent_path() {
        let result = sanitize_path("/this/path/does/not/exist/at/all");
        assert!(result.is_err());
    }

    #[test]
    fn test_create_file_dot_only() {
        let result = create_file("/tmp", ".");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::InvalidFilename(_)));
    }

    #[test]
    fn test_create_file_dotdot_only() {
        let result = create_file("/tmp", "..");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::InvalidFilename(_)));
    }
}
