// Permissions — the caller identity registry.
//
// The CallerRegistry is plain in-process state (no engine, no UI): it maps
// caller identities to uuids, blocks to owners, and block-relative field
// positions to renderIds. It's the shared foundation the App's permission glue
// (patch.ts, field-editable.ts) builds on — moving it here makes it usable from
// the Node runtime too.
//
// The engine-integration parts (monkey-patching the WorkbookClient, toast
// feedback, resolving FieldInfo via the live engine) stay in the App: they are
// UI/runtime glue, not portable logic.

import {simpleUuid} from '../utils/index.js'

const USER_KEY = '__user__'

/**
 * Session-scoped caller identities. The user and each craft get a random uuid
 * on first ask; a host tags each write with it and later maps it back (via
 * {@link resolveActor}) to the actor the engine's `mayModifyBlock` expects.
 * Nothing here persists: uuids and owner records are gone on reload, which
 * is why block ownership that must survive lives on the engine's block.
 */
class CallerRegistry {
    private _entries = new Map<string, string>()
    private _blockOwners = new Map<string, string>()
    // (sheetIdx, blockId, axis, block-relative offset) → field renderId.
    // Populated when the app's patch.ts observes a bindFormSchema payload.
    // It used to back the host-side `userEditable` check; that rule now lives
    // on the engine schema, and nothing outside tests reads this map.
    private _fieldPositions = new Map<string, string>()

    /** The user's uuid for this session. */
    getUserUuid(): string {
        return this._getOrAssign(USER_KEY)
    }

    /** A craft's uuid for this session. Throws for the reserved user key. */
    getCraftUuid(craftId: string): string {
        if (craftId === USER_KEY) {
            throw new Error(`invalid craftId: ${craftId}`)
        }
        return this._getOrAssign(craftId)
    }

    isUser(uuid: string | undefined): boolean {
        return uuid === this._entries.get(USER_KEY)
    }

    /**
     * The engine-side identity a caller uuid stands for: `'user'`, or the
     * craft named by the id it registered under.
     *
     * The uuids here are session-scoped, while a block's `owner` is a craft id
     * saved in the file — so asking the engine whether a caller may touch a
     * block means translating back first. `undefined` for a uuid this registry
     * never issued, which the caller should treat as unidentified rather than
     * as the user.
     */
    resolveActor(
        uuid: string | undefined
    ): {type: 'user'} | {type: 'craft'; craftId: string} | undefined {
        if (uuid === undefined) return undefined
        for (const [key, value] of this._entries) {
            if (value !== uuid) continue
            return key === USER_KEY
                ? {type: 'user'}
                : {type: 'craft', craftId: key}
        }
        return undefined
    }

    /** Record which caller created a block. In-memory only; keyed by
     *  `sheetIdx`, so it goes stale when sheets move. */
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

/** The process-wide registry. */
export const callerRegistry = new CallerRegistry()

// `FieldEditableInfo` and `isFieldUserEditable` used to live here, reading a tri-state `userEditable`
// boolean off the host's own field store. The field's write policy is declared
// on the engine schema now (`FieldWritePolicy`), and the app reads it from
// there — see src/core/blocks/field-projection.ts and
// design/block-field-semantics.md, so there is no host-side flag left to
// interpret.
