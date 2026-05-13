import {simpleUuid} from '@/core/uuid'

const USER_KEY = '__user__'

class CallerRegistry {
    private _entries = new Map<string, string>()
    private _blockOwners = new Map<string, string>()

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

    private _getOrAssign(key: string): string {
        const existing = this._entries.get(key)
        if (existing) return existing
        const uuid = simpleUuid()
        this._entries.set(key, uuid)
        return uuid
    }
}

export const callerRegistry = new CallerRegistry()
