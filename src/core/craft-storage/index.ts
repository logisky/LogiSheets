import {setCraftStorageBackend} from 'logisheets-core'
import {
    LocalStorageCraftBackend,
    isLocalStorageAvailable,
} from './local-storage'
import {TauriCraftBackend} from './tauri'

// Tauri v2 injects this global into every window it hosts. Its presence is the
// signal that we're running inside the desktop shell rather than a plain
// browser tab.
function isTauri(): boolean {
    return '__TAURI_INTERNALS__' in window
}

/**
 * Pick and install the craft-storage backend for the current platform. Call
 * once at app startup, before any craft iframe mounts.
 *
 *   desktop (Tauri)  -> native app-data file via `craft_storage_*` commands
 *   browser          -> localStorage
 *   neither usable    -> core's in-memory fallback (session-only)
 *
 * If neither persistent store is available (e.g. localStorage blocked in
 * private mode), we leave core's built-in in-memory backend in place so craft
 * calls still resolve instead of throwing.
 */
export function installCraftStorageBackend(): void {
    if (isTauri()) {
        setCraftStorageBackend(new TauriCraftBackend())
        return
    }
    if (isLocalStorageAvailable()) {
        setCraftStorageBackend(new LocalStorageCraftBackend())
        return
    }
    // Fall through: keep the in-memory fallback that core installs by default.
}
