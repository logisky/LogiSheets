/**
 * InstalledCraftStore — the host capability that lets Watson enumerate and load
 * installed crafts, VSCode-extension style. The store is platform-specific (web:
 * a DB / IndexedDB + fetch of the built package; desktop: an app-data dir), but
 * this interface is host-neutral so the discover/use tools work everywhere.
 *
 * See docs/craft/craftsmith.md → "Distribution, installation & enumeration".
 */

import type {CraftManifest} from './manifest.js'

/** Lightweight row for the discovery list (no tool detail). */
export interface InstalledCraftSummary {
    craftId: string
    label: string
    /** The skill's "when to use me" description, if the craft exposes tools. */
    description?: string
}

export interface InstalledCraftStore {
    /** Enumerate installed crafts — what `discover_skills` iterates. */
    list(): Promise<InstalledCraftSummary[]>
    /** Full manifest for one craft, or undefined if not installed. */
    get(craftId: string): Promise<CraftManifest | undefined>
    /**
     * Import a craft module by its manifest-relative entry (e.g. "tools.js") and
     * return its exports. On web this is a dynamic `import()` of the installed
     * package's URL; on desktop a file import. Implementations should cache.
     */
    load(craftId: string, entry: string): Promise<Record<string, unknown>>
}

/**
 * Merge several stores behind one InstalledCraftStore. This is how crafts from
 * different sources coexist: today a single WebCraftStore over the crafts bundled
 * into the app; once a marketplace/registry lands, add a DB-backed store for
 * downloaded crafts — `new CompositeCraftStore([registryStore, bundledStore])` —
 * and both show up in discovery, with no change to the discover/use tools.
 *
 * Precedence is by order: the FIRST store that knows a craftId owns it (so a
 * downloaded craft can shadow a bundled one if its store is listed first). All
 * of a craft's operations (get/load) route to its owning store.
 */
export class CompositeCraftStore implements InstalledCraftStore {
    private owner = new Map<string, InstalledCraftStore>()

    constructor(private readonly stores: readonly InstalledCraftStore[]) {}

    async list(): Promise<InstalledCraftSummary[]> {
        const seen = new Set<string>()
        const out: InstalledCraftSummary[] = []
        for (const store of this.stores) {
            let rows: InstalledCraftSummary[] = []
            try {
                rows = await store.list()
            } catch {
                rows = [] // one source being down must not sink the rest
            }
            for (const row of rows) {
                if (seen.has(row.craftId)) continue
                seen.add(row.craftId)
                this.owner.set(row.craftId, store)
                out.push(row)
            }
        }
        return out
    }

    async get(craftId: string): Promise<CraftManifest | undefined> {
        const known = this.owner.get(craftId)
        if (known) return known.get(craftId)
        for (const store of this.stores) {
            const m = await store.get(craftId)
            if (m) {
                this.owner.set(craftId, store)
                return m
            }
        }
        return undefined
    }

    async load(
        craftId: string,
        entry: string
    ): Promise<Record<string, unknown>> {
        let store = this.owner.get(craftId)
        if (!store) {
            await this.get(craftId) // resolve ownership
            store = this.owner.get(craftId)
        }
        if (!store)
            throw new Error(`craft "${craftId}" not found in any installed source`)
        return store.load(craftId, entry)
    }
}
