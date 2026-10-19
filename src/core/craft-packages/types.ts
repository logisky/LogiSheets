import type {CraftManifest} from 'logisheets-logician'

/**
 * The version of the API the host injects into a craft's window (`workbook`,
 * `onCanvasInput`, `craftStorage`, …). Bump it when that API changes in a way
 * an older craft cannot survive; a package whose manifest asks for a higher
 * `hostApi` is refused at install.
 */
export const HOST_API_VERSION = 1

/** One installed craft, as the store lists it. */
export interface InstalledCraftRecord {
    craftId: string
    version: string
    /** The packed manifest, `files` included. */
    manifest: CraftManifest
    /** `Date.now()` at install. */
    installedAt: number
}

/**
 * Where installed craft packages live: IndexedDB in a browser, the app-data
 * directory on desktop. The backend only stores what it is given —
 * `parseCraftPackage` has already validated it, and nothing here re-checks.
 */
export interface CraftPackageStore {
    list(): Promise<InstalledCraftRecord[]>
    /**
     * Replace whatever is installed under `record.craftId` with these files,
     * atomically: on failure the previous install (if any) is untouched.
     */
    install(
        record: InstalledCraftRecord,
        files: ReadonlyMap<string, Uint8Array>
    ): Promise<void>
    remove(craftId: string): Promise<void>
    /** A package file's bytes, or undefined if it is not installed. */
    readFile(craftId: string, path: string): Promise<Uint8Array | undefined>
}
