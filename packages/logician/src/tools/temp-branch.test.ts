import {describe, expect, it} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import type {ToolContext} from '../tool.js'
import {setCells} from './cells.js'
import {previewChanges} from './edit.js'
import {assertScratchBranchFree, withTempBranch} from './temp-branch.js'

/**
 * The workbook keeps ONE temp branch, and discarding it discards all of it.
 * These tests pin the two ways that used to cost a user their work: a
 * committed write (which the engine answers by throwing the branch away), and
 * a dry run (which opened the branch it found and then cleaned it up).
 */

/** One two-cell block, enough for a tool to resolve (block, row_key, field). */
const ORDERS_BLOCK = {
    sheetIdx: 0,
    sheetId: 7,
    blockId: 3,
    rowStart: 0,
    colStart: 0,
    rowCnt: 1,
    colCnt: 1,
    description: '',
    owner: 'watson',
    modifyPolicy: 'all',
    permissions: {},
    fieldRenders: [],
    cells: [],
    analyzedBy: [],
    schema: {
        name: 'orders',
        schemaType: 'row',
        keys: [{key: 'k1', idx: 0}],
        fields: [{field: 'qty', idx: 0, renderId: 'r'}],
        randomEntries: [],
    },
}

interface Recorded {
    committed: Array<{temp: boolean}>
    toggled: number
    cleaned: number
}

/** A workbook that reports `inTempMode` and records what was done to it. */
function client(
    opts: {inTempMode?: boolean; legacy?: boolean; block?: boolean} = {}
) {
    const {inTempMode = false, legacy = false, block = false} = opts
    const rec: Recorded = {committed: [], toggled: 0, cleaned: 0}
    const base: Record<string, unknown> = {
        getAllBlocks: async () => (block ? [ORDERS_BLOCK] : []),
        getAllSheetInfo: async () => [{name: 'Sheet1'}],
        getCells: async () => [],
        getTempStatusChanges: async () => ({cells: []}),
        handleTransaction: async ({
            transaction,
        }: {
            transaction: {temp: boolean}
        }) => {
            rec.committed.push({temp: transaction.temp})
            return {status: {type: 'ok'}, taskIdx: [], asyncTasks: []}
        },
        toggleStatus: async () => {
            rec.toggled += 1
            return undefined
        },
        cleanupTempStatus: async () => {
            rec.cleaned += 1
            return undefined
        },
    }
    // A host built against a `logisheets-web` older than the isInTempMode RPC
    // has no such method at all — that case must still work, not throw.
    if (!legacy) base.isInTempMode = async () => inTempMode
    return {client: base as unknown as Client, rec}
}

function ctxFor(c: Client): ToolContext {
    return {
        workbook: c,
        signal: new AbortController().signal,
        confirm: async () => true,
        log: () => {},
    }
}

describe('assertScratchBranchFree', () => {
    it('lets a write through when no branch is open', async () => {
        const {client: c} = client({inTempMode: false})
        await expect(
            assertScratchBranchFree(c, 'set_cells')
        ).resolves.toBeUndefined()
    })

    it('refuses while somebody else holds the branch', async () => {
        const {client: c} = client({inTempMode: true})
        await expect(assertScratchBranchFree(c, 'set_cells')).rejects.toThrow(
            /uncommitted scratch-branch edits/
        )
    })

    it('proceeds when the client cannot answer', async () => {
        // Refusing every write against an older client would be a worse
        // failure than the race it guards against.
        const {client: c} = client({legacy: true})
        await expect(
            assertScratchBranchFree(c, 'set_cells')
        ).resolves.toBeUndefined()
    })
})

describe('cell__set_cells', () => {
    it('writes nothing while the user is in temp mode', async () => {
        // The engine discards the temp branch before applying any non-temp
        // action, so letting this through would delete the user's session.
        const {client: c, rec} = client({inTempMode: true})
        await expect(
            setCells.handler(
                {sheetIdx: 0, cells: [{row: 0, col: 0, content: 1}]},
                ctxFor(c)
            )
        ).rejects.toThrow(/temp mode|scratch-branch/)
        expect(rec.committed).toEqual([])
    })

    it('writes normally otherwise', async () => {
        const {client: c, rec} = client({inTempMode: false})
        await setCells.handler(
            {sheetIdx: 0, cells: [{row: 0, col: 0, content: 1}]},
            ctxFor(c)
        )
        expect(rec.committed).toEqual([{temp: false}])
    })
})

describe('withTempBranch', () => {
    it('opens and discards its own branch', async () => {
        const {client: c, rec} = client({inTempMode: false})
        const out = await withTempBranch(c, 'preview_changes', async () => 42)
        expect(out).toBe(42)
        expect(rec.toggled).toBe(1)
        expect(rec.cleaned).toBe(1)
    })

    it('discards the branch even when the body throws', async () => {
        const {client: c, rec} = client({inTempMode: false})
        await expect(
            withTempBranch(c, 'preview_changes', async () => {
                throw new Error('boom')
            })
        ).rejects.toThrow('boom')
        expect(rec.cleaned).toBe(1)
    })

    it('never touches a branch it does not own', async () => {
        const {client: c, rec} = client({inTempMode: true})
        await expect(
            withTempBranch(c, 'preview_changes', async () => 1)
        ).rejects.toThrow(/already in use/)
        // The point of the refusal: no cleanup ran, so the other owner's
        // edits are still there.
        expect(rec.toggled).toBe(0)
        expect(rec.cleaned).toBe(0)
    })
})

describe('edit__preview_changes', () => {
    it('refuses rather than discarding the user’s temp-mode edits', async () => {
        const {client: c, rec} = client({inTempMode: true, block: true})
        await expect(
            previewChanges.handler(
                {
                    changes: [
                        {
                            block: 'orders',
                            row_key: 'k1',
                            field: 'qty',
                            value: 1,
                        },
                    ],
                },
                ctxFor(c)
            )
        ).rejects.toThrow(/already in use/)
        // Nothing was opened and nothing was discarded, so the edits the user
        // had on the branch are still on it.
        expect(rec.toggled).toBe(0)
        expect(rec.cleaned).toBe(0)
    })
})
