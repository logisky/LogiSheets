/**
 * End-to-end proof that what is LEFT in the AppData blob round-trips.
 *
 * This file used to prove that `FieldManager` was rebuilt on file load: a field
 * was authored host-side, serialized through `BlockManager.getPersistentData`
 * into the AppData envelope, saved to real .xlsx bytes, loaded back, and
 * rebuilt with its type / validation / required intact. That store is gone —
 * everything a field means is on the engine schema now, which has its own
 * round-trip test in `block-field-semantics.test.ts`.
 *
 * What the blob still carries, and the only thing it carries, is the COLOUR of
 * each enum variant: presentation the engine deliberately does not hold. The
 * options themselves come from the workbook's enum table, so the host's job on
 * load is to merge the two — and this proves the colour half survives the file.
 *
 * See design/block-field-semantics.md.
 */
import {describe, it, expect} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'
import {BlockManager} from '../../engine/src/lib/block/manager'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpc(
    method: string,
    params?: Record<string, unknown>,
    bookId?: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

describe('AppData round-trip (real .xlsx)', () => {
    it('carries enum variant colours, and nothing about a field', () => {
        // 1. A host registry with colours, serialized exactly as save does.
        const src = new BlockManager()
        src.enumSetManager.set('status', 'Order status', [
            {id: 'open', value: 'Open', color: '#112233'},
            {id: 'done', value: 'Done', color: '#445566'},
        ])
        const persisted = src.getPersistentData([])

        // The blob is colours only. A field's type, description, required,
        // unique and write policy are on the schema — putting them here as
        // well is what made them invisible to every other host.
        const shape = JSON.parse(persisted) as {
            variantColors: Record<string, string>
        }
        expect(Object.keys(shape)).toEqual(['variantColors'])
        expect(shape.variantColors['status/open']).toBe('#112233')
        expect(shape.variantColors['status/done']).toBe('#445566')
        // Colours are keyed `setId/variantId`, so a set being renamed or
        // re-labelled in the workbook does not orphan them.
        expect(
            Object.keys(shape.variantColors).every((k) => k.includes('/'))
        ).toBe(true)

        const envelope = JSON.stringify({
            version: 1,
            blockManager: persisted,
            craftInteractions: {},
            craftStates: {},
        })

        // 2. Save to real .xlsx bytes and load them into a fresh workbook.
        const bookId = rpc('newWorkbook') as number
        const saved = rpc('saveWorkbook', {appData: envelope}, bookId) as {
            code: number
            data: number[] | Uint8Array
        }
        expect(saved.code).toBe(0)
        const bytes = Array.isArray(saved.data)
            ? saved.data
            : Array.from(saved.data)
        expect(bytes.length).toBeGreaterThan(0)

        const restored = rpc('newWorkbook') as number
        rpc('loadWorkbook', {content: bytes, name: 'rt.xlsx'}, restored)
        const appData = rpc('getAppData', undefined, restored) as {
            name: string
            data: string
        }[]
        const ours = appData.find((d) => d.name === 'logisheets')
        expect(ours).toBeDefined()

        // 3. Rebuild the host registry from it, as the file-open flow does.
        const dst = new BlockManager()
        dst.parseAppData(JSON.parse(ours!.data).blockManager)

        const set = dst.enumSetManager.get('status')
        expect(set).toBeDefined()
        const byId = new Map(set!.variants.map((v) => [v.id, v.color]))
        expect(byId.get('open')).toBe('#112233')
        expect(byId.get('done')).toBe('#445566')
    })

    it('still reads the colours out of a blob an older build wrote', () => {
        // An older build wrote the whole enum set into `enumSets`, colours
        // included. Its options are redundant now — the workbook's enum table
        // supplies those — but its colours are the user's, so they are read.
        const legacy = JSON.stringify({
            fields: JSON.stringify([
                {id: 'r0', sheetId: 1, blockId: 1, name: 'Sales'},
            ]),
            // The registry serialized itself as `[id, info]` entry pairs.
            enumSets: JSON.stringify([
                [
                    'status',
                    {
                        id: 'status',
                        name: 'Order status',
                        variants: [
                            {id: 'open', value: 'Open', color: '#aabbcc'},
                        ],
                    },
                ],
            ]),
        })

        const dst = new BlockManager()
        dst.parseAppData(legacy)
        const set = dst.enumSetManager.get('status')
        expect(set?.variants[0].color).toBe('#aabbcc')
    })
})
