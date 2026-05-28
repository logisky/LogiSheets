import {EphemeralCellInputBuilder} from '../bindings/ephemeral_cell_input'
import {EphemeralCellRemoveBuilder} from '../bindings/ephemeral_cell_remove'
import type {Value} from '../bindings/value'
import type {Client} from '../client'
import {isErrorMessage} from './utils'

// Ephemeral-cell-id partitioning:
//
//   0x0000_0000_0000_0000 .. 0x0000_0000_FFFF_FFFF   engine-reserved
//   0x0000_0001_0000_0000 .. ...                     per-craft ranges
//
// Each craft gets a fresh range of CRAFT_RANGE_SIZE ids on acquire.
// JS Number is safe to 2^53, the bindings take id as `number`, so we
// keep both base and offset in plain Number. With 2^32 reserved for the
// engine and 2^20 per craft, we can hand out ~2^21 craft ranges before
// running into precision concerns — plenty.
const ENGINE_RESERVED_END = 0x1_0000_0000 // 2^32
const CRAFT_RANGE_SIZE = 1 << 20 // 2^20 ids per craft

// Bumped on every acquire. Lives for the JS session only; on reload
// crafts re-acquire and get fresh ranges. Since crafts hold no state of
// their own and rebuild from blocks, the id range identity does not need
// to survive reloads.
let nextCraftBase = ENGINE_RESERVED_END

/**
 * Per-craft temporary-calculation handle.
 *
 * Each craft (or the host UI, treated identically) acquires one of these
 * via {@link acquireCraftCalc}. The handle scopes a private range of
 * ephemeral cell ids; the craft picks small `localId` numbers and never
 * sees engine-wide ids.
 *
 * Two flavours:
 *  - {@link calcOnce} — fire-and-forget. Uses one reserved slot inside
 *    the craft's range; each call overwrites the previous result.
 *  - {@link setCalc} / {@link getCalc} / {@link dropCalc} — caller-owned
 *    `localId`. The slot persists (and auto-recomputes on dep changes)
 *    until dropped.
 *
 * Slot 0 inside each craft range is reserved for `calcOnce`; user
 * `localId`s are transparently offset by 1 so they cannot collide.
 *
 * Lifetime notes:
 *  - Ephemeral cells are wiped on file save/load (that's what "ephemeral"
 *    means). No reload-survival design is needed.
 *  - `dropCalc` removes one slot; `dropAll` removes every slot the craft
 *    has touched in this session — both emit `ephemeralCellRemove`
 *    payloads which free the container slot and detach the cell from the
 *    dependency graph.
 */
export class CraftCalc {
    // Host scratch sheet hosting all ephemeral calc cells. Sheet 0 is
    // always present in any workbook this API targets. BLOCKREF and
    // other ref-name lookups don't care which sheet hosts the cell.
    private static readonly HOST_SHEET_IDX = 0

    private readonly _base: number
    // Cached resolved sheetId for HOST_SHEET_IDX.
    private _sheetId: number | undefined
    // Engine ids of every slot we've written this session, so dropAll
    // can flush them all. `_oneShotEngineId()` lazily lands here too the
    // first time calcOnce runs.
    private readonly _live = new Set<number>()

    constructor(private readonly _workbook: Client, base: number) {
        this._base = base
    }

    /**
     * Evaluate `formula` once and return the result. Internally uses the
     * craft's reserved one-shot slot; consecutive calls overwrite each
     * other. Safe across calls within the same craft (the slot is
     * craft-private); concurrent in-flight calls within one craft race
     * for the slot — caller should await one before issuing the next.
     *
     * `formula` may be passed with or without a leading `=`.
     */
    public async calcOnce(formula: string): Promise<Value> {
        return this._evaluate(this._oneShotEngineId(), formula)
    }

    /**
     * Set (or replace) the formula in a caller-owned slot and return the
     * freshly computed value. `localId` is craft-local — pick any
     * non-negative integer; collisions between crafts are impossible.
     */
    public async setCalc(localId: number, formula: string): Promise<Value> {
        return this._evaluate(this._userEngineId(localId), formula)
    }

    /**
     * Read the current value of a previously-set slot. The value
     * auto-tracks dependency changes (same depgraph the workbook uses
     * for normal cells), so repeated `getCalc` calls reflect the latest
     * state without re-issuing the formula.
     *
     * Throws if `localId` was never `setCalc`-ed (or has been dropped).
     */
    public async getCalc(localId: number): Promise<Value> {
        const sheetId = await this._resolveSheetId()
        const engineId = this._userEngineId(localId)
        const infos = await this._workbook.batchGetCellInfoById({
            ids: [
                {
                    sheetId,
                    cellId: {type: 'ephemeralCell', value: engineId},
                },
            ],
        })
        if (isErrorMessage(infos))
            throw new Error(
                `getCalc(${localId}) failed: ${JSON.stringify(infos)}`
            )
        return infos[0].value
    }

    /**
     * Release a caller-owned slot. Emits one `ephemeralCellRemove`
     * payload — frees the container slot and removes the cell from the
     * dependency graph. Safe to call on a slot that was never written
     * (the engine treats it as a no-op).
     */
    public async dropCalc(localId: number): Promise<void> {
        await this._remove(this._userEngineId(localId))
    }

    /**
     * Release every slot this handle has touched this session in one
     * transaction. Call on craft unmount.
     */
    public async dropAll(): Promise<void> {
        if (this._live.size === 0) return
        const payloads = Array.from(this._live).map((engineId) => ({
            type: 'ephemeralCellRemove' as const,
            value: new EphemeralCellRemoveBuilder()
                .sheetIdx(CraftCalc.HOST_SHEET_IDX)
                .id(engineId)
                .build(),
        }))
        this._live.clear()
        const res = await this._workbook.handleTransaction({
            transaction: {payloads, undoable: false, temp: false},
        })
        if (isErrorMessage(res))
            throw new Error(`dropAll failed: ${JSON.stringify(res)}`)
    }

    // -- internals ------------------------------------------------------

    private _oneShotEngineId(): number {
        return this._base // slot 0 inside the range
    }

    private _userEngineId(localId: number): number {
        if (!Number.isInteger(localId) || localId < 0)
            throw new Error(
                `localId must be a non-negative integer: ${localId}`
            )
        const offset = localId + 1 // reserve slot 0 for calcOnce
        if (offset >= CRAFT_RANGE_SIZE)
            throw new Error(
                `localId ${localId} exceeds craft range size ${CRAFT_RANGE_SIZE}`
            )
        return this._base + offset
    }

    private async _resolveSheetId(): Promise<number> {
        if (this._sheetId !== undefined) return this._sheetId
        const r = await this._workbook.getSheetId({
            sheetIdx: CraftCalc.HOST_SHEET_IDX,
        })
        if (isErrorMessage(r))
            throw new Error(
                `CraftCalc: getSheetId(0) failed: ${JSON.stringify(r)}`
            )
        this._sheetId = r
        return r
    }

    private async _remove(engineId: number): Promise<void> {
        this._live.delete(engineId)
        const res = await this._workbook.handleTransaction({
            transaction: {
                payloads: [
                    {
                        type: 'ephemeralCellRemove',
                        value: new EphemeralCellRemoveBuilder()
                            .sheetIdx(CraftCalc.HOST_SHEET_IDX)
                            .id(engineId)
                            .build(),
                    },
                ],
                undoable: false,
                temp: false,
            },
        })
        if (isErrorMessage(res))
            throw new Error(`CraftCalc: drop failed: ${JSON.stringify(res)}`)
    }

    private async _evaluate(engineId: number, formula: string): Promise<Value> {
        this._live.add(engineId)
        const expr = formula.startsWith('=') ? formula : `=${formula}`
        const writeResult = await this._workbook.handleTransaction({
            transaction: {
                payloads: [
                    {
                        type: 'ephemeralCellInput',
                        value: new EphemeralCellInputBuilder()
                            .sheetIdx(CraftCalc.HOST_SHEET_IDX)
                            .id(engineId)
                            .content(expr)
                            .build(),
                    },
                ],
                undoable: false,
                temp: false,
            },
        })
        if (isErrorMessage(writeResult))
            throw new Error(
                `CraftCalc: formula evaluation failed: ${JSON.stringify(
                    writeResult
                )}`
            )

        const sheetId = await this._resolveSheetId()
        const infos = await this._workbook.batchGetCellInfoById({
            ids: [
                {
                    sheetId,
                    cellId: {type: 'ephemeralCell', value: engineId},
                },
            ],
        })
        if (isErrorMessage(infos))
            throw new Error(
                `CraftCalc: read-back failed: ${JSON.stringify(infos)}`
            )
        return infos[0].value
    }
}

/**
 * Allocate a fresh ephemeral-id range and return a {@link CraftCalc}
 * handle scoped to it. Call once per craft (or per host-UI context).
 */
export function acquireCraftCalc(workbook: Client): CraftCalc {
    const base = nextCraftBase
    nextCraftBase += CRAFT_RANGE_SIZE
    return new CraftCalc(workbook, base)
}
