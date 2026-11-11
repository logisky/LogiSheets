#[cfg(feature = "native-engine")]
mod commands;
mod crafts;
mod db;
mod net;
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
/// Build the main window (declared in tauri.conf.json with `create: false`).
///
/// Built here rather than by Tauri so it can carry an `on_new_window` handler:
/// the app's pop-out views (`src/ui/popout-window.tsx`) `window.open` an empty
/// window and render into it from the main page's JS realm, sharing its one
/// engine. That only works if the new webview is the opener's real child —
/// same WebView2 environment / WKWebViewConfiguration, which `window_features`
/// carries over — rather than a URL handed to the system browser.
fn main_window(app: &tauri::App) -> tauri::Result<()> {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};

    static NEXT_POPOUT: AtomicUsize = AtomicUsize::new(1);
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .expect("tauri.conf.json declares the main window")
        .clone();
    let handle = app.handle().clone();
    WebviewWindowBuilder::from_config(app, &config)?
        .on_new_window(move |url, features| {
            let label = format!("popout-{}", NEXT_POPOUT.fetch_add(1, Ordering::Relaxed));
            let built =
                WebviewWindowBuilder::new(&handle, label, tauri::WebviewUrl::External(url.clone()))
                    .window_features(features)
                    // The pop-out sets `document.title` after it opens.
                    .on_document_title_changed(|window, title| {
                        let _ = window.set_title(&title);
                    })
                    .build();
            match built {
                Ok(window) => NewWindowResponse::Create { window },
                Err(e) => {
                    eprintln!("pop-out window {url}: {e}");
                    NewWindowResponse::Deny
                }
            }
        })
        .build()?;
    Ok(())
}

/// Close every pop-out window. The web app can't: JS `window.close()` on one
/// is a no-op here, since wry's macOS delegate has no `webViewDidClose`.
#[tauri::command]
fn close_popouts(app: tauri::AppHandle) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("popout-") {
            let _ = window.close();
        }
    }
}

/// Open a cell's hyperlink with the system's default handler (the browser, the
/// mail client). The webview can't: `window.open` lands in `on_new_window`
/// above and would open the site inside the app.
///
/// Only `http(s):` and `mailto:` — a link comes from a workbook, which may come
/// from anyone, and handing `file:` or a custom scheme to the OS can launch
/// programs. The web app checks the same list; this is the gate that counts.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let lower = url.trim_start().to_ascii_lowercase();
    if !["http://", "https://", "mailto:"]
        .iter()
        .any(|p| lower.starts_with(p))
    {
        return Err(format!(
            "not opening {url:?}: only http(s) and mailto links are allowed"
        ));
    }
    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut c = std::process::Command::new("open");
        c.arg(&url);
        c
    };
    // Not `cmd /C start`, which would parse `&` in the URL as a command
    // separator.
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("rundll32");
        c.args(["url.dll,FileProtocolHandler", &url]);
        c
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut cmd = {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(&url);
        c
    };
    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("could not open {url:?}: {e}"))
}

pub fn run() {
    let builder = tauri::Builder::default()
        // Device-scoped craft storage (backs the web app's window.craftStorage).
        // The store is loaded in `setup`, where the AppHandle can resolve the
        // app-data directory.
        .setup(|app| {
            let store = storage::CraftStorageState::load(app.handle());
            app.manage(store);
            // Saved data connections (metadata only; passwords are in the keychain).
            app.manage(db::DbState::load(app.handle()));
            main_window(app)?;
            Ok(())
        })
        // A pop-out renders from the main window's JS realm, so it is dead
        // UI once that is gone.
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                close_popouts(window.app_handle().clone());
            }
        });

    // `invoke_handler` can be set only once, so the full command list is chosen
    // per configuration: craft-storage, installed crafts and data connections always, plus the
    // native engine `handle` when that feature is on.
    #[cfg(feature = "native-engine")]
    let builder = builder
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            storage::craft_storage_get,
            storage::craft_storage_set,
            storage::craft_storage_remove,
            storage::craft_storage_keys,
            storage::craft_storage_clear,
            net::llm_fetch,
            open_url,
            crafts::craft_pkg_list,
            crafts::craft_pkg_install,
            crafts::craft_pkg_remove,
            crafts::craft_pkg_read,
            db::db_conn_list,
            db::db_conn_save,
            db::db_conn_delete,
            db::db_conn_test,
            db::db_query,
            close_popouts,
            commands::handle,
        ]);

    #[cfg(not(feature = "native-engine"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        storage::craft_storage_get,
        storage::craft_storage_set,
        storage::craft_storage_remove,
        storage::craft_storage_keys,
        storage::craft_storage_clear,
        net::llm_fetch,
        open_url,
        crafts::craft_pkg_list,
        crafts::craft_pkg_install,
        crafts::craft_pkg_remove,
        crafts::craft_pkg_read,
        db::db_conn_list,
        db::db_conn_save,
        db::db_conn_delete,
        db::db_conn_test,
        db::db_query,
        close_popouts,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running LogiSheets desktop app");
}
