import type {CraftStorageBackend} from 'logisheets-core'

// The desktop package deliberately declares NO Tauri npm dependency (see
// packages/desktop/README.md — keeps the GUI toolchain out of `yarn install`),
// so we can't `import { invoke } from '@tauri-apps/api/core'`. Tauri v2 always
// injects its IPC entry point at runtime as `window.__TAURI_INTERNALS__.invoke`,
// so we call that directly. Arguments are camelCase here and map to the Rust
// command's snake_case parameters (Tauri v2 converts automatically).
type TauriInvoke = <T>(
    cmd: string,
    args?: Record<string, unknown>
) => Promise<T>

interface TauriInternals {
    invoke: TauriInvoke
}

function getInvoke(): TauriInvoke {
    const internals = (
        window as unknown as {__TAURI_INTERNALS__?: TauriInternals}
    ).__TAURI_INTERNALS__
    if (!internals || typeof internals.invoke !== 'function')
        throw new Error('Tauri IPC is unavailable')
    return internals.invoke
}

/**
 * Desktop backend: forwards each operation to the native `craft_storage_*`
 * commands, which persist to a JSON file in the app-data directory (see
 * packages/desktop/src-tauri/src/storage.rs). Selected at startup only when the
 * Tauri runtime is detected (see ./index.ts).
 */
export class TauriCraftBackend implements CraftStorageBackend {
    get(craftId: string, key: string): Promise<string | null> {
        return getInvoke()<string | null>('craft_storage_get', {craftId, key})
    }

    set(craftId: string, key: string, value: string): Promise<void> {
        return getInvoke()<void>('craft_storage_set', {craftId, key, value})
    }

    remove(craftId: string, key: string): Promise<void> {
        return getInvoke()<void>('craft_storage_remove', {craftId, key})
    }

    keys(craftId: string): Promise<string[]> {
        return getInvoke()<string[]>('craft_storage_keys', {craftId})
    }

    clear(craftId: string): Promise<void> {
        return getInvoke()<void>('craft_storage_clear', {craftId})
    }
}
