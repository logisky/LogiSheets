import type {CraftStorageBackend} from 'logisheets-core'

// All craft-storage entries share a single flat namespace inside the app
// origin's localStorage. Each entry is keyed
//   logisheets.craft.<craftId>.<key>
// so `keys()`/`clear()` can scope to one craft by prefix scan, and different
// crafts never collide.
const ROOT = 'logisheets.craft.'

function prefixFor(craftId: string): string {
    return `${ROOT}${craftId}.`
}

/**
 * Web backend: persists to `window.localStorage`. Synchronous under the hood,
 * wrapped in resolved promises to satisfy the async {@link CraftStorageBackend}
 * contract. Writes can throw (quota exceeded, or a browser in private mode that
 * disallows storage); those surface as a rejected promise so the craft can
 * react. The startup selector (see ./index.ts) falls back to the in-memory
 * backend when localStorage is entirely unavailable.
 */
export class LocalStorageCraftBackend implements CraftStorageBackend {
    async get(craftId: string, key: string): Promise<string | null> {
        return window.localStorage.getItem(prefixFor(craftId) + key)
    }

    async set(craftId: string, key: string, value: string): Promise<void> {
        window.localStorage.setItem(prefixFor(craftId) + key, value)
    }

    async remove(craftId: string, key: string): Promise<void> {
        window.localStorage.removeItem(prefixFor(craftId) + key)
    }

    async keys(craftId: string): Promise<string[]> {
        const prefix = prefixFor(craftId)
        const out: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
            const full = window.localStorage.key(i)
            if (full && full.startsWith(prefix))
                out.push(full.slice(prefix.length))
        }
        return out
    }

    async clear(craftId: string): Promise<void> {
        const prefix = prefixFor(craftId)
        // Collect first, then delete: removing while iterating by index shifts
        // the remaining entries and would skip some.
        const doomed: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
            const full = window.localStorage.key(i)
            if (full && full.startsWith(prefix)) doomed.push(full)
        }
        for (const full of doomed) window.localStorage.removeItem(full)
    }
}

// Probe whether localStorage is usable right now (it throws on access in some
// privacy modes, and may be absent in non-browser hosts).
export function isLocalStorageAvailable(): boolean {
    try {
        const probe = '__logisheets_probe__'
        window.localStorage.setItem(probe, '1')
        window.localStorage.removeItem(probe)
        return true
    } catch {
        return false
    }
}
