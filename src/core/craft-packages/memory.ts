import type {CraftPackageStore, InstalledCraftRecord} from './types'

/**
 * Session-only store: the fallback when no persistent backend is usable
 * (IndexedDB blocked), and the one tests use. Installs vanish on reload.
 */
export class MemoryCraftPackageStore implements CraftPackageStore {
    private records = new Map<string, InstalledCraftRecord>()
    private files = new Map<string, ReadonlyMap<string, Uint8Array>>()

    async list(): Promise<InstalledCraftRecord[]> {
        return [...this.records.values()]
    }

    async install(
        record: InstalledCraftRecord,
        files: ReadonlyMap<string, Uint8Array>
    ): Promise<void> {
        this.records.set(record.craftId, record)
        this.files.set(record.craftId, new Map(files))
    }

    async remove(craftId: string): Promise<void> {
        this.records.delete(craftId)
        this.files.delete(craftId)
    }

    async readFile(
        craftId: string,
        path: string
    ): Promise<Uint8Array | undefined> {
        return this.files.get(craftId)?.get(path)
    }
}
