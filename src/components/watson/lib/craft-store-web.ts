/**
 * Browser InstalledCraftStore — bootstrap implementation.
 *
 * Serves crafts from where the app already hosts them: `/<craftId>/manifest.json`
 * for discovery and `import('/<craftId>/<entry>')` for dispatch. The set of
 * "installed" crafts is passed in (today: the build's craft distribution); when
 * the real marketplace/registry lands, only this store's `installedIds` source
 * and base URL change — the InstalledCraftStore contract and the discover/use
 * tools stay put.
 *
 * See docs/craft/craftsmith.md → "Distribution, installation & enumeration".
 */

import type {
    CraftManifest,
    InstalledCraftStore,
    InstalledCraftSummary,
} from 'logisheets-logician'

export interface WebCraftStoreOptions {
    /** Craft ids considered installed (e.g. the current distribution's list). */
    installedIds: readonly string[]
    /** Base path crafts are served under. Default '/'. */
    baseUrl?: string
    /** Override fetch (tests). Defaults to global fetch. */
    fetchImpl?: typeof fetch
    /** Override module import (tests). Defaults to dynamic import(). */
    importImpl?: (url: string) => Promise<Record<string, unknown>>
}

export class WebCraftStore implements InstalledCraftStore {
    private ids: readonly string[]
    private base: string
    private doFetch: typeof fetch
    private doImport: (url: string) => Promise<Record<string, unknown>>

    private manifestCache = new Map<string, CraftManifest | undefined>()
    private moduleCache = new Map<string, Promise<Record<string, unknown>>>()

    constructor(opts: WebCraftStoreOptions) {
        this.ids = opts.installedIds
        this.base = (opts.baseUrl ?? '/').replace(/\/+$/, '') + '/'
        this.doFetch = opts.fetchImpl ?? ((...a) => fetch(...a))
        this.doImport =
            opts.importImpl ??
            ((url) => import(/* @vite-ignore */ url) as Promise<Record<string, unknown>>)
    }

    private urlFor(craftId: string, file: string): string {
        return `${this.base}${craftId}/${file}`
    }

    async get(craftId: string): Promise<CraftManifest | undefined> {
        if (this.manifestCache.has(craftId))
            return this.manifestCache.get(craftId)
        let manifest: CraftManifest | undefined
        try {
            const res = await this.doFetch(this.urlFor(craftId, 'manifest.json'))
            if (res.ok) manifest = (await res.json()) as CraftManifest
        } catch {
            manifest = undefined
        }
        this.manifestCache.set(craftId, manifest)
        return manifest
    }

    async list(): Promise<InstalledCraftSummary[]> {
        const out: InstalledCraftSummary[] = []
        for (const id of this.ids) {
            const m = await this.get(id)
            if (!m) continue
            // Only surface crafts that actually expose a skill (have tools).
            if (!m.skill) continue
            out.push({
                craftId: m.craftId,
                label: m.label,
                description: m.skill.description,
            })
        }
        return out
    }

    async load(
        craftId: string,
        entry: string
    ): Promise<Record<string, unknown>> {
        const url = this.urlFor(craftId, entry)
        let mod = this.moduleCache.get(url)
        if (!mod) {
            mod = this.doImport(url)
            this.moduleCache.set(url, mod)
        }
        return mod
    }
}
