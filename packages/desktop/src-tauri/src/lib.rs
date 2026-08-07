#[cfg(feature = "native-engine")]
mod commands;
mod storage;

use tauri::Manager;

/// Entry point for the LogiSheets desktop app (Tauri host).
///
/// Default build (Plan A): a thin shell that loads the existing web app — the
/// engine runs as WASM in the webview's worker, exactly as in the browser.
/// Tauri provides the native window, packaging, updater, menus, and filesystem.
///
/// With `--features native-engine`: also registers the in-process native engine
/// `handle` command (mirror of the browser WASM `handle`) for a future hybrid /
/// full-native path. Off by default so the shell doesn't bundle a second engine.
pub fn run() {
    let builder = tauri::Builder::default()
        // Device-scoped craft storage (backs the web app's window.craftStorage).
        // The store is loaded in `setup`, where the AppHandle can resolve the
        // app-data directory.
        .setup(|app| {
            let store = storage::CraftStorageState::load(app.handle());
            app.manage(store);
            Ok(())
        });

    // `invoke_handler` can be set only once, so the full command list is chosen
    // per configuration: craft-storage always, plus the native engine `handle`
    // when that feature is on.
    #[cfg(feature = "native-engine")]
    let builder = builder
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            storage::craft_storage_get,
            storage::craft_storage_set,
            storage::craft_storage_remove,
            storage::craft_storage_keys,
            storage::craft_storage_clear,
            commands::handle,
        ]);

    #[cfg(not(feature = "native-engine"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        storage::craft_storage_get,
        storage::craft_storage_set,
        storage::craft_storage_remove,
        storage::craft_storage_keys,
        storage::craft_storage_clear,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running LogiSheets desktop app");
}
