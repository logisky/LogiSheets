import type {CraftManifest} from 'logisheets-logician'
import {IndexedDbCraftPackageStore, isIndexedDbAvailable} from './indexeddb'
import {MemoryCraftPackageStore} from './memory'
import {TauriCraftPackageStore} from './tauri'
import type {CraftPackageStore, InstalledCraftRecord} from './types'
import {parseCraftPackage, type ParsedCraftPackage} from './validate'

export * from './types'
export {
    CraftPackageError,
    type CraftPackageErrorCode,
    type ParsedCraftPackage,
} from './validate'

/**
 * One craft the panel can offer, built-in or installed.
 *
 * `key` is `/<craftId>/index.html` for BOTH kinds. It is the string the host
 * has always keyed a craft by — craft state in saved workbooks, block
 * ownership (`callerRegistry`), the active craft for canvas input — so an
 * installed craft slots into all of that unchanged. For a built-in it is also
 * the URL the iframe loads; an installed craft's page comes from the loader.
 */
export interface CraftEntry {
    key: string
    craftId: string
    /** Label per language; resolve at render, the language can change. */
    label: Record<string, string>
    source: 'builtin' | 'installed'
    /** False for a tools-only craft: Watson sees it, the panel does not. */
    hasUi: boolean
    version?: string
    manifest?: CraftManifest
}

export function craftKey(craftId: string): string {
    return `/${craftId}/index.html`
}

function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function pickStore(): CraftPackageStore {
    if (isTauri()) return new TauriCraftPackageStore()
    if (isIndexedDbAvailable()) return new IndexedDbCraftPackageStore()
    return new MemoryCraftPackageStore()
}

function builtinEntries(): CraftEntry[] {
    const tools = typeof __CRAFT_TOOLS__ !== 'undefined' ? __CRAFT_TOOLS__ : []
    return tools.map((t) => ({
        key: t.value,
        craftId: t.value.replace(/^\/+/, '').replace(/\/index\.html$/, ''),
        label: t.label,
        source: 'builtin' as const,
        hasUi: true,
    }))
}

/**
 * Ids an installed craft may not take: every craft bundled with the app in ANY
 * distribution (a workbook moves between builds, and its craft state and block
 * owners are keyed by id) and the host's own. Registry crafts are not bundled,
 * so their ids are free to install.
 */
export function reservedCraftIds(): Set<string> {
    const ids =
        typeof __RESERVED_CRAFT_IDS__ !== 'undefined'
            ? __RESERVED_CRAFT_IDS__
            : []
    return new Set([
        ...ids,
        ...builtinEntries().map((e) => e.craftId),
        'watson',
    ])
}

let store: CraftPackageStore | null = null
let registry: CraftEntry[] | null = null

export function getCraftPackageStore(): CraftPackageStore {
    if (!store) store = pickStore()
    return store
}

/**
 * Build the craft list: built-ins, then installed crafts. Call once at startup,
 * BEFORE anything reads `getCraftRegistry()`. The list is fixed for the life
 * of the page — installing or uninstalling takes effect on the next reload,
 * so nothing has to cope with a craft appearing or vanishing under it.
 *
 * Never throws: if the store cannot be read, the app still starts, with
 * built-ins only.
 */
export async function initCraftRegistry(): Promise<void> {
    const builtins = builtinEntries()
    let installed: InstalledCraftRecord[] = []
    try {
        installed = await getCraftPackageStore().list()
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[crafts] could not list installed crafts', e)
    }
    const reserved = reservedCraftIds()
    registry = [
        ...builtins,
        ...installed
            // A build that later ships a craft under the same id wins.
            .filter((r) => !reserved.has(r.craftId))
            .sort((a, b) => a.craftId.localeCompare(b.craftId))
            .map((r) => ({
                key: craftKey(r.craftId),
                craftId: r.craftId,
                label: r.manifest.labels ?? {en: r.manifest.label},
                source: 'installed' as const,
                hasUi: !!r.manifest.url,
                version: r.version,
                manifest: r.manifest,
            })),
    ]
}

/** The craft list fixed at startup (built-ins only before `init`). */
export function getCraftRegistry(): readonly CraftEntry[] {
    return registry ?? builtinEntries()
}

export function findCraftEntry(key: string): CraftEntry | undefined {
    return getCraftRegistry().find((e) => e.key === key)
}

export interface CraftInstallPreview {
    parsed: ParsedCraftPackage
    /** Version currently installed under the same id, if any. */
    installedVersion?: string
}

/**
 * Validate a `.craft` file and say what installing it would replace. Throws a
 * `CraftPackageError` if the package is refused. Nothing is written.
 */
export async function previewCraftPackage(
    bytes: Uint8Array
): Promise<CraftInstallPreview> {
    const parsed = parseCraftPackage(bytes, reservedCraftIds())
    const existing = (await getCraftPackageStore().list()).find(
        (r) => r.craftId === parsed.manifest.craftId
    )
    return {parsed, installedVersion: existing?.version}
}

export async function installCraftPackage(
    parsed: ParsedCraftPackage
): Promise<void> {
    await getCraftPackageStore().install(
        {
            craftId: parsed.manifest.craftId,
            version: parsed.manifest.version,
            manifest: parsed.manifest,
            installedAt: Date.now(),
        },
        parsed.files
    )
}

export function uninstallCraft(craftId: string): Promise<void> {
    return getCraftPackageStore().remove(craftId)
}

/** Installed crafts as stored now — may differ from the startup registry. */
export function listInstalledCrafts(): Promise<InstalledCraftRecord[]> {
    return getCraftPackageStore().list()
}
