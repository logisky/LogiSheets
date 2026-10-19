//! Installed craft packages — the desktop backend for the web app's
//! `CraftPackageStore` (see src/core/craft-packages/tauri.ts).
//!
//! Layout, under the app-data directory:
//!
//! ```text
//! crafts/<craftId>/record.json   the InstalledCraftRecord (manifest included)
//! crafts/<craftId>/<path>        each package file
//! ```
//!
//! The webview validates a package before it gets here, but the webview is not
//! the only thing that can `invoke`, so every id and path is checked again: a
//! path that could leave `crafts/<craftId>/` is refused, not normalised.
//!
//! Install writes to `crafts/.staging-<craftId>/` and renames it over the old
//! directory, so a failed install leaves the previous version in place.

use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, Manager};

const RECORD: &str = "record.json";
// Same limits as src/core/craft-packages/validate.ts.
const MAX_FILE_BYTES: usize = 5 * 1024 * 1024;
const MAX_PACKAGE_BYTES: usize = 20 * 1024 * 1024;

#[derive(Deserialize)]
pub struct PackageFile {
    path: String,
    /// base64
    data: String,
}

fn crafts_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("crafts");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Kebab-case, at most 32 characters — `isValidCraftId` in validate.ts.
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 32
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        && !id.starts_with('-')
}

/// `isSafePackagePath` in validate.ts: relative, `/`-separated, each segment
/// `[A-Za-z0-9_-][A-Za-z0-9._-]*`. No `.`/`..`, no absolute, no backslash.
fn valid_path(p: &str) -> bool {
    !p.is_empty()
        && p.len() <= 200
        && p.split('/').all(|seg| {
            let mut bytes = seg.bytes();
            match bytes.next() {
                Some(b) if b.is_ascii_alphanumeric() || b == b'_' || b == b'-' => {}
                _ => return false,
            }
            bytes.all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-' || b == b'.')
        })
}

fn record_id(record: &Value) -> Option<&str> {
    record.get("craftId").and_then(Value::as_str)
}

#[tauri::command]
pub fn craft_pkg_list(app: AppHandle) -> Result<Vec<Value>, String> {
    let dir = crafts_dir(&app)?;
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let Ok(entry) = entry else { continue };
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        // Skips `.staging-*` left by an interrupted install.
        if !valid_id(name) {
            continue;
        }
        let Ok(bytes) = fs::read(entry.path().join(RECORD)) else {
            continue;
        };
        let Ok(record) = serde_json::from_slice::<Value>(&bytes) else {
            continue;
        };
        if record_id(&record) == Some(name) {
            out.push(record);
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn craft_pkg_install(
    app: AppHandle,
    record: Value,
    files: Vec<PackageFile>,
) -> Result<(), String> {
    let id = record_id(&record)
        .filter(|id| valid_id(id))
        .ok_or("invalid craftId")?
        .to_string();

    let mut decoded = Vec::with_capacity(files.len());
    let mut total = 0usize;
    for f in &files {
        if !valid_path(&f.path) || f.path == RECORD {
            return Err(format!("invalid package path: {}", f.path));
        }
        let data = STANDARD.decode(&f.data).map_err(|e| e.to_string())?;
        if data.len() > MAX_FILE_BYTES {
            return Err(format!("{} is too large", f.path));
        }
        total += data.len();
        decoded.push((f.path.as_str(), data));
    }
    if total > MAX_PACKAGE_BYTES {
        return Err("package is too large".into());
    }

    let dir = crafts_dir(&app)?;
    let staging = dir.join(format!(".staging-{id}"));
    let target = dir.join(&id);
    let _ = fs::remove_dir_all(&staging);
    let write = || -> Result<(), String> {
        for (path, data) in &decoded {
            let dest = staging.join(path);
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(&dest, data).map_err(|e| e.to_string())?;
        }
        let rec = serde_json::to_vec_pretty(&record).map_err(|e| e.to_string())?;
        fs::write(staging.join(RECORD), rec).map_err(|e| e.to_string())
    };
    if let Err(e) = write() {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }
    // Not atomic across the two steps, but the window is a rename, and a
    // crash in it loses the old version rather than leaving a half-written
    // new one.
    if target.exists() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
    }
    fs::rename(&staging, &target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn craft_pkg_remove(app: AppHandle, craft_id: String) -> Result<(), String> {
    if !valid_id(&craft_id) {
        return Err("invalid craftId".into());
    }
    let target = crafts_dir(&app)?.join(&craft_id);
    if target.exists() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// The file's bytes as base64, or `None` if it is not installed.
#[tauri::command]
pub fn craft_pkg_read(
    app: AppHandle,
    craft_id: String,
    path: String,
) -> Result<Option<String>, String> {
    if !valid_id(&craft_id) || !valid_path(&path) || path == RECORD {
        return Err("invalid craft file".into());
    }
    let file: PathBuf = crafts_dir(&app)?.join(&craft_id).join(Path::new(&path));
    match fs::read(&file) {
        Ok(bytes) => Ok(Some(STANDARD.encode(bytes))),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids() {
        assert!(valid_id("lights-out"));
        assert!(!valid_id(""));
        assert!(!valid_id("-x"));
        assert!(!valid_id("A"));
        assert!(!valid_id("a_b"));
        assert!(!valid_id(".staging-x"));
        assert!(!valid_id(&"x".repeat(33)));
    }

    #[test]
    fn paths() {
        for ok in ["index.html", "assets/a-b_c.v2.png"] {
            assert!(valid_path(ok), "{ok}");
        }
        for bad in [
            "",
            "/abs.js",
            "../up.js",
            "a/../b.js",
            "./a.js",
            "a//b.js",
            "a\\b.js",
            ".hidden",
            "C:/x.js",
        ] {
            assert!(!valid_path(bad), "{bad}");
        }
    }
}
