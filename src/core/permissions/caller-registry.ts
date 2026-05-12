import {simpleUuid} from '@/core/uuid'

const USER_KEY = '__user__'

class CallerRegistry {
    private _entries = new Map<string, string>()

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

    private _getOrAssign(key: string): string {
        const existing = this._entries.get(key)
        if (existing) return existing
        const uuid = simpleUuid()
        this._entries.set(key, uuid)
        return uuid
    }
}

export const callerRegistry = new CallerRegistry()
