//! Device-scoped, per-craft key/value storage — the desktop backend for the
//! web app's `window.craftStorage` (see src/core/craft-storage/tauri.ts).
//!
//! Everything is kept in one JSON file in the app-data directory:
//!
//! ```json
//! { "version": 1, "crafts": { "<craftId>": { "<key>": "<value>" } } }
//! ```
//!
//! The whole file is loaded once into a `Mutex`-guarded map and rewritten after
//! each mutation. Craft storage is written rarely (a craft persisting its
//! settings), so a full rewrite per change is fine and keeps the code simple.
//! Values are opaque strings; the file is plaintext, so crafts must not store
//! secrets here.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

const FILE_NAME: &str = "craft-storage.json";
const CURRENT_VERSION: u32 = 1;

#[derive(Default, Serialize, Deserialize)]
struct StorageFile {
    version: u32,
    // craftId -> (key -> value)
    crafts: HashMap<String, HashMap<String, String>>,
}

/// Managed Tauri state: the in-memory mirror of the on-disk file, plus the
/// resolved path we write back to. Guarded by a `Mutex` since Tauri may invoke
/// commands from multiple threads.
pub struct CraftStorageState {
    inner: Mutex<StorageFile>,
    path: PathBuf,
}

impl CraftStorageState {
    /// Load (or initialize) the store from the app-data directory. Called once
    /// during setup, when the `AppHandle` can resolve paths.
    pub fn load(app: &AppHandle) -> Self {
        // `app_data_dir` is derived from the app identifier; create it if the
        // app has never written data before.
        let dir = app
            .path()
            .app_data_dir()
            .expect("no app-data directory for this platform");
        let _ = fs::create_dir_all(&dir);
        let path = dir.join(FILE_NAME);

        let inner = fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<StorageFile>(&bytes).ok())
            .unwrap_or_else(|| StorageFile {
                version: CURRENT_VERSION,
                crafts: HashMap::new(),
            });

        CraftStorageState {
            inner: Mutex::new(inner),
            path,
        }
    }

    // Persist the current map. Best-effort: a failed write is reported to the
    // caller so the craft can surface it, but the in-memory value still stands
    // for the rest of the session.
    fn flush(&self, file: &StorageFile) -> Result<(), String> {
        let bytes = serde_json::to_vec_pretty(file).map_err(|e| e.to_string())?;
        fs::write(&self.path, bytes).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn craft_storage_get(
    craft_id: String,
    key: String,
    state: State<CraftStorageState>,
) -> Option<String> {
    let file = state.inner.lock().unwrap();
    file.crafts
        .get(&craft_id)
        .and_then(|ns| ns.get(&key))
        .cloned()
}

#[tauri::command]
pub fn craft_storage_set(
    craft_id: String,
    key: String,
    value: String,
    state: State<CraftStorageState>,
) -> Result<(), String> {
    let mut file = state.inner.lock().unwrap();
    file.crafts.entry(craft_id).or_default().insert(key, value);
    state.flush(&file)
}

#[tauri::command]
pub fn craft_storage_remove(
    craft_id: String,
    key: String,
    state: State<CraftStorageState>,
) -> Result<(), String> {
    let mut file = state.inner.lock().unwrap();
    if let Some(ns) = file.crafts.get_mut(&craft_id) {
        ns.remove(&key);
    }
    state.flush(&file)
}

#[tauri::command]
pub fn craft_storage_keys(craft_id: String, state: State<CraftStorageState>) -> Vec<String> {
    let file = state.inner.lock().unwrap();
    file.crafts
        .get(&craft_id)
        .map(|ns| ns.keys().cloned().collect())
        .unwrap_or_default()
}

#[tauri::command]
pub fn craft_storage_clear(
    craft_id: String,
    state: State<CraftStorageState>,
) -> Result<(), String> {
    let mut file = state.inner.lock().unwrap();
    file.crafts.remove(&craft_id);
    state.flush(&file)
}
