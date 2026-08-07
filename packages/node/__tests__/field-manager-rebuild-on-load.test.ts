/**
 * End-to-end proof that FieldManager is rebuilt on file load.
 *
 * Author a field host-side, serialize it exactly as the toolbar does
 * (BlockManager.getPersistentData -> appData envelope), save into a real
 * workbook -> .xlsx bytes, load the bytes into a fresh workbook, read the
 * appData back (getAppData), then rebuild a fresh BlockManager from it
 * (BlockManager.parseAppData) — mirroring the host's file-open flow — and
 * assert the field came back with its type/validation/required intact.
 */
import {describe, it, expect} from 'vitest'
import {handle} from '../wasm/logisheets_wasm_server'
import {BlockManager} from '../../engine/src/lib/block/manager'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rpc(method: string, params?: Record<string, unknown>, bookId?: number): any {
    const msg = params === undefined ? method : {method, value: params}
    return handle(msg, bookId ?? null)
}

describe('FieldManager rebuild on load (real .xlsx round-trip)', () => {
    it('a field survives save -> .xlsx -> load -> rebuild', () => {
        // 1. Author a field and serialize exactly as the toolbar's save does.
        const src = new BlockManager()
        const f = src.fieldManager.create(1, 1, {
            name: 'Sales',
            type: {type: 'number', validation: '#PLACEHOLDER>0', formatter: '0.00'},
            required: true,
            unique: false,
            validationRaw: '#PLACEHOLDER>0',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        const envelope = JSON.stringify({
            version: 1,
            blockManager: src.getPersistentData([]),
            craftInteractions: {},
            craftStates: {},
        })

        // 2. Save into a real workbook -> .xlsx bytes.
        const bookId = rpc('newWorkbook') as number
        const saved = rpc('saveWorkbook', {appData: envelope}, bookId) as {
            code: number
            data: number[] | Uint8Array
        }
        expect(saved.code).toBe(0)
        const bytes = Array.isArray(saved.data) ? saved.data : Array.from(saved.data)
        expect(bytes.length).toBeGreaterThan(0)

        // 3. Load the bytes into a fresh workbook and read appData back.
        const restored = rpc('newWorkbook') as number
        rpc('loadWorkbook', {content: bytes, name: 'rt.xlsx'}, restored)
        const appData = rpc('getAppData', undefined, restored) as {
            name: string
            data: string
        }[]
        const ours = appData.find((d) => d.name === 'logisheets')
        expect(ours).toBeDefined()

        // 4. Rebuild FieldManager from the loaded appData (host file-open flow).
        const dst = new BlockManager()
        dst.parseAppData(JSON.parse(ours!.data).blockManager)

        const rf = dst.fieldManager.get(f.id)
        expect(rf).toBeDefined()
        expect(rf!.name).toBe('Sales')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((rf!.type as any).type).toBe('number')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((rf as any).validationRaw).toBe('#PLACEHOLDER>0')
        expect(rf!.required).toBe(true)
    })
})
