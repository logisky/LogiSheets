// Device-scoped, per-craft key/value storage.
//
// This is the sibling of craft STATE (see ./state.ts) but with the opposite
// scope. Craft state rides the workbook's AppData, so it travels inside the
// .xlsx and is per-document. Craft storage instead lives on the DEVICE — the
// browser origin's localStorage on the web, and the app-data directory on the
// desktop — so it persists across workbooks and never leaves the machine.
//
// A craft (running in its iframe) reaches storage through the injected
// `window.craftStorage` object, which the host binds to that craft's id. Every
// operation is async because the desktop backend talks to the native side over
// IPC; the web backend wraps synchronous localStorage in resolved promises so
// both platforms present the same interface.
//
// Values are opaque strings — the craft owns its own schema, exactly as with
// craft state. The store is plaintext on both platforms, so crafts must not use
// it for secrets.

/**
 * The per-craft handle injected onto the craft iframe's `window` as
 * `window.craftStorage`. All keys/values are scoped to the owning craft; a
 * craft can neither see nor touch another craft's namespace.
 */
export interface CraftStorage {
    /** Read a value, or `null` if the key was never set. */
    get(key: string): Promise<string | null>
    /** Write a value, overwriting any previous one. */
    set(key: string, value: string): Promise<void>
    /** Delete a single key. A no-op if it doesn't exist. */
    remove(key: string): Promise<void>
    /** List every key this craft has stored. */
    keys(): Promise<string[]>
    /** Delete every key in THIS craft's namespace only. */
    clear(): Promise<void>
}

/**
 * The platform-specific store the host injects at startup. It is the same
 * shape as {@link CraftStorage} but takes an explicit `craftId`, so a single
 * backend instance serves every craft while keeping their namespaces isolated.
 * Concrete implementations (localStorage, Tauri app-data) live host-side; core
 * only defines the seam, mirroring how the engine Client is injected.
 */
export interface CraftStorageBackend {
    get(craftId: string, key: string): Promise<string | null>
    set(craftId: string, key: string, value: string): Promise<void>
    remove(craftId: string, key: string): Promise<void>
    keys(craftId: string): Promise<string[]>
    clear(craftId: string): Promise<void>
}

// In-memory fallback used until a host injects a real backend, and on hosts
// with no persistent store (SSR, a Node runtime, or a browser in private mode
// where localStorage throws). Data lives only for the session.
class MemoryCraftStorageBackend implements CraftStorageBackend {
    private readonly crafts = new Map<string, Map<string, string>>()

    private ns(craftId: string): Map<string, string> {
        let m = this.crafts.get(craftId)
        if (!m) {
            m = new Map()
            this.crafts.set(craftId, m)
        }
        return m
    }

    async get(craftId: string, key: string): Promise<string | null> {
        const v = this.ns(craftId).get(key)
        return v === undefined ? null : v
    }
    async set(craftId: string, key: string, value: string): Promise<void> {
        this.ns(craftId).set(key, value)
    }
    async remove(craftId: string, key: string): Promise<void> {
        this.ns(craftId).delete(key)
    }
    async keys(craftId: string): Promise<string[]> {
        return [...this.ns(craftId).keys()]
    }
    async clear(craftId: string): Promise<void> {
        this.crafts.delete(craftId)
    }
}

let activeBackend: CraftStorageBackend = new MemoryCraftStorageBackend()

/**
 * Install the concrete backend for this host. Called once at app startup
 * (e.g. localStorage in the browser, a Tauri command bridge on the desktop).
 * Until this runs, craft storage transparently uses an in-memory fallback.
 */
export function setCraftStorageBackend(backend: CraftStorageBackend): void {
    activeBackend = backend
}

/**
 * Build the per-craft {@link CraftStorage} handle the host injects as
 * `window.craftStorage`. It closes over `craftId` and forwards to whichever
 * backend is active at call time, so swapping the backend affects every craft
 * uniformly and the craft can never reach outside its own namespace.
 */
export function makeCraftStorage(craftId: string): CraftStorage {
    return {
        get: (key) => activeBackend.get(craftId, key),
        set: (key, value) => activeBackend.set(craftId, key, value),
        remove: (key) => activeBackend.remove(craftId, key),
        keys: () => activeBackend.keys(craftId),
        clear: () => activeBackend.clear(craftId),
    }
}
