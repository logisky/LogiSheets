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
import {getCraftPackageStore, getCraftRegistry} from '@/core/craft-packages'

export interface WebCraftStoreOptions {
    /** Craft ids considered installed (e.g. the current distribution's list). */
    installedIds: readonly string[]
    /** Base path crafts are served under. Default '/'. */
    baseUrl?: string
    /** Override fetch (tests). Defaults to global fetch. */
    fetchImpl?: typeof fetch
    /** Override module import (tests). Defaults to dynamic import(). */
    importImpl?: (url: string) => Promise<Record<string, unknown>>
    /**
     * Crafts the user installed (see src/core/craft-packages). They have no
     * server path: their manifest and tool modules are read from the package
     * store instead of fetched. Their ids must also be in `installedIds`.
     */
    packages?: {
        ids: ReadonlySet<string>
        readFile(craftId: string, path: string): Promise<Uint8Array | undefined>
    }
}

/** Import a self-contained ES module from bytes (see importSelfContained). */
async function importBytes(
    bytes: Uint8Array
): Promise<Record<string, unknown>> {
    const blobUrl = URL.createObjectURL(
        new Blob([bytes as BlobPart], {type: 'text/javascript'})
    )
    try {
        return (await import(/* @vite-ignore */ blobUrl)) as Record<
            string,
            unknown
        >
    } finally {
        URL.revokeObjectURL(blobUrl)
    }
}

/**
 * Import a built craft bundle by URL.
 *
 * Fetched as text and imported as a blob rather than `import(url)` directly:
 * crafts are served out of `public/`, and Vite's dev server refuses to hand a
 * `public/` file to the module pipeline ("should not be imported from source
 * code ... can only be referenced via HTML tags"), so a direct dynamic import
 * 500s in dev and every craft tool comes back as an error the model then
 * retries against. A craft bundle is self-contained by construction —
 * `craftsmith build` bundles it with no bare imports — so there is nothing for
 * the pipeline to resolve, and going through a blob behaves the same in dev and
 * in production.
 *
 * The cost is that the module's stack frames say `blob:` rather than the craft
 * file; the URL is revoked once imported, so nothing accumulates.
 */
async function importSelfContained(
    url: string
): Promise<Record<string, unknown>> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`craft module ${url}: HTTP ${res.status}`)
    const blobUrl = URL.createObjectURL(
        new Blob([await res.text()], {type: 'text/javascript'})
    )
    try {
        return (await import(/* @vite-ignore */ blobUrl)) as Record<
            string,
            unknown
        >
    } finally {
        URL.revokeObjectURL(blobUrl)
    }
}

export class WebCraftStore implements InstalledCraftStore {
    private ids: readonly string[]
    private base: string
    private doFetch: typeof fetch
    private doImport: (url: string) => Promise<Record<string, unknown>>
    private packages: WebCraftStoreOptions['packages']

    private manifestCache = new Map<string, CraftManifest | undefined>()
    private moduleCache = new Map<string, Promise<Record<string, unknown>>>()

    constructor(opts: WebCraftStoreOptions) {
        this.ids = opts.installedIds
        this.base = (opts.baseUrl ?? '/').replace(/\/+$/, '') + '/'
        this.doFetch = opts.fetchImpl ?? ((...a) => fetch(...a))
        this.doImport = opts.importImpl ?? importSelfContained
        this.packages = opts.packages
    }

    private isPackage(craftId: string): boolean {
        return !!this.packages?.ids.has(craftId)
    }

    private urlFor(craftId: string, file: string): string {
        return `${this.base}${craftId}/${file}`
    }

    async get(craftId: string): Promise<CraftManifest | undefined> {
        if (this.manifestCache.has(craftId))
            return this.manifestCache.get(craftId)
        let manifest: CraftManifest | undefined
        if (this.isPackage(craftId)) {
            try {
                const bytes = await this.packages!.readFile(
                    craftId,
                    'manifest.json'
                )
                if (bytes)
                    manifest = JSON.parse(
                        new TextDecoder().decode(bytes)
                    ) as CraftManifest
            } catch {
                manifest = undefined
            }
            this.manifestCache.set(craftId, manifest)
            return manifest
        }
        try {
            const res = await this.doFetch(
                this.urlFor(craftId, 'manifest.json')
            )
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
            mod = this.isPackage(craftId)
                ? this.packages!.readFile(craftId, entry).then((bytes) => {
                      if (!bytes)
                          throw new Error(`craft module ${url}: not installed`)
                      return importBytes(bytes)
                  })
                : this.doImport(url)
            this.moduleCache.set(url, mod)
        }
        return mod
    }
}

/**
 * The store over every craft this page knows: the startup craft registry,
 * built-ins fetched from their server path, installed crafts read from the
 * package store.
 */
export function createAppCraftStore(
    exclude: readonly string[] = []
): WebCraftStore {
    const entries = getCraftRegistry().filter(
        (e) => !exclude.includes(e.craftId)
    )
    const packageStore = getCraftPackageStore()
    return new WebCraftStore({
        installedIds: entries.map((e) => e.craftId),
        packages: {
            ids: new Set(
                entries
                    .filter((e) => e.source === 'installed')
                    .map((e) => e.craftId)
            ),
            readFile: (craftId, path) => packageStore.readFile(craftId, path),
        },
    })
}
