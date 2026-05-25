import {simpleUuid} from '@/core/uuid'

const USER_KEY = '__user__'

class CallerRegistry {
    private _entries = new Map<string, string>()
    private _blockOwners = new Map<string, string>()
    // (sheetIdx, blockId, block-relative col) → field renderId. Populated
    // when patch.ts observes a bindFormSchema payload. Lets the cellInput
    // validator look up the FieldInfo for any block cell to enforce
    // FieldInfo.userEditable.
    private _fieldPositions = new Map<string, string>()

    getUserUuid(): string {
        return this._getOrAssign(USER_KEY)
    }

    getCraftUuid(craftId: string): string {
        if (craftId === USER_KEY) {
            throw new Error(`invalid craftId: ${craftId}`)
        }
        return this._getOrAssign(craftId)
    }

    isUser(uuid: string | undefined): boolean {
        return uuid === this._entries.get(USER_KEY)
    }

    registerBlockOwner(
        sheetIdx: number,
        blockId: number,
        callerUuid: string
    ): void {
        this._blockOwners.set(`${sheetIdx}-${blockId}`, callerUuid)
    }

    getBlockOwner(sheetIdx: number, blockId: number): string | undefined {
        return this._blockOwners.get(`${sheetIdx}-${blockId}`)
    }

    /**
     * Register the field at a specific block-relative position.
     * `axis = 'col'` — column-oriented form (one field per column);
     * `axis = 'row'` — row-oriented form (one field per row).
     */
    registerFieldPosition(
        sheetIdx: number,
        blockId: number,
        axis: 'col' | 'row',
        offset: number,
        renderId: string
    ): void {
        this._fieldPositions.set(
            `${sheetIdx}-${blockId}-${axis}-${offset}`,
            renderId
        )
    }

    getFieldRenderId(
        sheetIdx: number,
        blockId: number,
        blockRow: number,
        blockCol: number
    ): string | undefined {
        // Try column-oriented form first, then row-oriented. A block
        // shouldn't be bound to both — first hit wins.
        return (
            this._fieldPositions.get(
                `${sheetIdx}-${blockId}-col-${blockCol}`
            ) ??
            this._fieldPositions.get(`${sheetIdx}-${blockId}-row-${blockRow}`)
        )
    }

    private _getOrAssign(key: string): string {
        const existing = this._entries.get(key)
        if (existing) return existing
        const uuid = simpleUuid()
        this._entries.set(key, uuid)
        return uuid
    }
}

export const callerRegistry = new CallerRegistry()
