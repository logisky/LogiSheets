#[cfg(feature = "native-engine")]
mod commands;

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
    let builder = tauri::Builder::default();

    #[cfg(feature = "native-engine")]
    let builder = builder
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![commands::handle]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running LogiSheets desktop app");
}
