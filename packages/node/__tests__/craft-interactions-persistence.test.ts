/**
 * End-to-end save/load test for craft-interactions persistence.
 *
 * What this proves: the JSON envelope the host packs into the `appData`
 * slot (`{version, blockManager, craftInteractions}`) survives a full
 * .xlsx round-trip through Rust — save → bytes → load → getAppData →
 * exact string back.
 *
 * What this does NOT prove: that factory simulator (or any craft) drives
 * those selections from real user clicks. That requires a browser-level
 * harness (Playwright) which is not set up. The host-side state-machine
 * is covered by `src/core/craft-interactions/index.test.ts`.
 *
 * Together the two layers cover both halves of the persistence contract:
 *   layer 1: host state ↔ JSON
 *   layer 2 (here): JSON ↔ .xlsx bytes (this file)
 */
import {describe, it, expect, beforeEach} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'

function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

interface AppDataEntry {
    name: string
    data: string
}

interface SaveResult {
    code: number
    data: number[] | Uint8Array
}

describe('craft-interactions persistence (xlsx round-trip)', () => {
    let bookId: number

    beforeEach(() => {
        bookId = rpc('newWorkbook') as number
    })

    it('round-trips the host envelope byte-identically through .xlsx', () => {
        const envelope = JSON.stringify({
            version: 1,
            blockManager: '',
            craftInteractions: {
                radioSelections: {g1: 'a', g2: 'b'},
                multiSelectSelections: {m1: ['x', 'y']},
                pointAllocations: {
                    p1: [{blockId: 1, row: 0, col: 0, points: 3}],
                },
            },
        })

        const saved = rpc(
            'saveWorkbook',
            {appData: envelope},
            bookId
        ) as SaveResult
        expect(saved.code).toBe(0)
        expect(Array.isArray(saved.data) || saved.data instanceof Uint8Array)
            .toBe(true)

        const bytes = Array.isArray(saved.data)
            ? saved.data
            : Array.from(saved.data)
        expect(bytes.length).toBeGreaterThan(0)

        // Load the bytes into a fresh workbook (mirroring the host's
        // file-open flow: new bookId, then loadWorkbook).
        const restoredBookId = rpc('newWorkbook') as number
        const loadResult = rpc(
            'loadWorkbook',
            {content: bytes, name: 'roundtrip.xlsx'},
            restoredBookId
        )
        expect(loadResult).toBeDefined()

        const appData = rpc(
            'getAppData',
            undefined,
            restoredBookId
        ) as readonly AppDataEntry[]

        expect(Array.isArray(appData)).toBe(true)
        const ours = appData.find((d) => d.name === 'logisheets')
        expect(ours).toBeDefined()
        // The Rust side stores `data` as opaque text — the host gets the
        // exact string back. This is the contract our envelope relies on.
        expect(ours!.data).toBe(envelope)

        // And the host can re-parse it.
        const parsed = JSON.parse(ours!.data)
        expect(parsed.version).toBe(1)
        expect(parsed.craftInteractions.radioSelections).toEqual({
            g1: 'a',
            g2: 'b',
        })
        expect(parsed.craftInteractions.multiSelectSelections).toEqual({
            m1: ['x', 'y'],
        })
        expect(parsed.craftInteractions.pointAllocations.p1).toEqual([
            {blockId: 1, row: 0, col: 0, points: 3},
        ])
    })

    it('survives an empty interactions payload (fresh workbook save)', () => {
        const envelope = JSON.stringify({
            version: 1,
            blockManager: '',
            craftInteractions: {
                radioSelections: {},
                multiSelectSelections: {},
                pointAllocations: {},
            },
        })
        const saved = rpc(
            'saveWorkbook',
            {appData: envelope},
            bookId
        ) as SaveResult
        expect(saved.code).toBe(0)

        const restoredBookId = rpc('newWorkbook') as number
        rpc(
            'loadWorkbook',
            {
                content: Array.isArray(saved.data)
                    ? saved.data
                    : Array.from(saved.data),
                name: 'empty.xlsx',
            },
            restoredBookId
        )
        const appData = rpc(
            'getAppData',
            undefined,
            restoredBookId
        ) as readonly AppDataEntry[]
        const ours = appData.find((d) => d.name === 'logisheets')
        expect(ours!.data).toBe(envelope)
    })

    it('preserves a legacy raw BlockManager string (back-compat)', () => {
        // Files saved before the envelope change carry the raw
        // BlockManager string in `appData`. The host's load path detects
        // this (no `version` field → legacy) and routes the whole string
        // to BlockManager.parseAppData. The Rust layer is unaware of
        // envelope vs legacy — it just has to round-trip the bytes,
        // which is what we check here.
        const legacyPayload = '{"fields":[],"counter":0}'
        const saved = rpc(
            'saveWorkbook',
            {appData: legacyPayload},
            bookId
        ) as SaveResult
        expect(saved.code).toBe(0)

        const restoredBookId = rpc('newWorkbook') as number
        rpc(
            'loadWorkbook',
            {
                content: Array.isArray(saved.data)
                    ? saved.data
                    : Array.from(saved.data),
                name: 'legacy.xlsx',
            },
            restoredBookId
        )
        const appData = rpc(
            'getAppData',
            undefined,
            restoredBookId
        ) as readonly AppDataEntry[]
        const ours = appData.find((d) => d.name === 'logisheets')
        expect(ours!.data).toBe(legacyPayload)
    })
})
