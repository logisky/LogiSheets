import type {CraftPackageStore, InstalledCraftRecord} from './types'

type TauriInvoke = <T>(
    cmd: string,
    args?: Record<string, unknown>
) => Promise<T>

// Same reasoning as craft-storage/tauri.ts: no Tauri npm dependency, so call
// the IPC entry point Tauri v2 injects.
function getInvoke(): TauriInvoke {
    const internals = (
        window as unknown as {__TAURI_INTERNALS__?: {invoke: TauriInvoke}}
    ).__TAURI_INTERNALS__
    if (!internals || typeof internals.invoke !== 'function')
        throw new Error('Tauri IPC is unavailable')
    return internals.invoke
}

// Bytes cross IPC as base64: Tauri's JSON IPC would otherwise send a
// Uint8Array as an array of numbers, several times larger.
function toBase64(bytes: Uint8Array): string {
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
    const s = atob(b64)
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
}

/**
 * Desktop backend: packages under `<app_data_dir>/crafts/<craftId>/`, via
 * the `craft_pkg_*` commands in packages/desktop/src-tauri/src/crafts.rs.
 */
export class TauriCraftPackageStore implements CraftPackageStore {
    list(): Promise<InstalledCraftRecord[]> {
        return getInvoke()<InstalledCraftRecord[]>('craft_pkg_list')
    }

    install(
        record: InstalledCraftRecord,
        files: ReadonlyMap<string, Uint8Array>
    ): Promise<void> {
        return getInvoke()<void>('craft_pkg_install', {
            record,
            files: [...files].map(([path, data]) => ({
                path,
                data: toBase64(data),
            })),
        })
    }

    remove(craftId: string): Promise<void> {
        return getInvoke()<void>('craft_pkg_remove', {craftId})
    }

    async readFile(
        craftId: string,
        path: string
    ): Promise<Uint8Array | undefined> {
        const b64 = await getInvoke()<string | null>('craft_pkg_read', {
            craftId,
            path,
        })
        return b64 == null ? undefined : fromBase64(b64)
    }
}
