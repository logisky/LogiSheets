import Dexie, {type Table} from 'dexie'
import type {CraftPackageStore, InstalledCraftRecord} from './types'

interface FileRow {
    craftId: string
    path: string
    data: Uint8Array
}

class CraftPackagesDB extends Dexie {
    crafts!: Table<InstalledCraftRecord, string>
    files!: Table<FileRow, [string, string]>

    constructor() {
        super('logisheets-crafts')
        this.version(1).stores({
            crafts: 'craftId',
            files: '[craftId+path], craftId',
        })
    }
}

/**
 * Browser backend: installed packages in IndexedDB, not localStorage. The
 * latter is ~5 MB per origin, already shared with craft-storage, Watson's
 * settings and the locale, holds only strings, and blocks the main thread.
 */
export class IndexedDbCraftPackageStore implements CraftPackageStore {
    private db = new CraftPackagesDB()

    list(): Promise<InstalledCraftRecord[]> {
        return this.db.crafts.toArray()
    }

    async install(
        record: InstalledCraftRecord,
        files: ReadonlyMap<string, Uint8Array>
    ): Promise<void> {
        // One transaction across both tables: a failed install rolls back to
        // whatever version was there before.
        await this.db.transaction(
            'rw',
            this.db.crafts,
            this.db.files,
            async () => {
                await this.db.files
                    .where('craftId')
                    .equals(record.craftId)
                    .delete()
                await this.db.files.bulkPut(
                    [...files].map(([path, data]) => ({
                        craftId: record.craftId,
                        path,
                        data,
                    }))
                )
                await this.db.crafts.put(record)
            }
        )
        // Ask the browser not to evict installed crafts under storage
        // pressure. Best effort: it may say no, and older browsers lack it.
        try {
            await navigator.storage?.persist?.()
        } catch {
            /* not fatal */
        }
    }

    async remove(craftId: string): Promise<void> {
        await this.db.transaction(
            'rw',
            this.db.crafts,
            this.db.files,
            async () => {
                await this.db.files.where('craftId').equals(craftId).delete()
                await this.db.crafts.delete(craftId)
            }
        )
    }

    async readFile(
        craftId: string,
        path: string
    ): Promise<Uint8Array | undefined> {
        const row = await this.db.files.get([craftId, path])
        return row?.data
    }
}

export function isIndexedDbAvailable(): boolean {
    try {
        return typeof indexedDB !== 'undefined' && indexedDB !== null
    } catch {
        return false
    }
}
