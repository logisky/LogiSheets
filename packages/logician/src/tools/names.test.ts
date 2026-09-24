import {describe, expect, it} from 'vitest'
import type {ToolContext} from '../tool.js'
import {defineName, deleteName, listNames, renameName} from './names.js'

/**
 * A workbook that keeps names in a map (case-insensitively, as the engine
 * does) and records the payloads sent.
 */
function fakeWorkbook() {
    const names = new Map<string, {name: string; formula: string}>()
    const sent: Array<{type: string; value: Record<string, unknown>}> = []
    const workbook = {
        isInTempMode: async () => false,
        getDefinedNames: async () => [...names.values()],
        handleTransaction: async ({
            transaction,
        }: {
            transaction: {payloads: typeof sent}
        }) => {
            for (const p of transaction.payloads) {
                sent.push(p)
                const v = p.value as Record<string, string>
                const key = (n: string) => n.toUpperCase()
                if (p.type === 'defineName')
                    names.set(key(v.name), {
                        name: names.get(key(v.name))?.name ?? v.name,
                        formula: v.formula,
                    })
                if (p.type === 'removeName') names.delete(key(v.name))
                if (p.type === 'renameName') {
                    const formula = names.get(key(v.oldName))?.formula ?? ''
                    names.delete(key(v.oldName))
                    names.set(key(v.newName), {name: v.newName, formula})
                }
            }
            return {status: {type: 'ok', value: 'cell'}}
        },
    }
    return {ctx: {workbook} as unknown as ToolContext, names, sent}
}

describe('name tools', () => {
    it('defines, lists, renames and deletes through the payloads', async () => {
        const {ctx, names, sent} = fakeWorkbook()
        const defined = await defineName.handler(
            {name: 'Sales', refersTo: 'Sheet1!$B$2:$B$9'},
            ctx
        )
        expect(defined.data).toEqual({
            name: 'Sales',
            refersTo: 'Sheet1!$B$2:$B$9',
            replaced: false,
        })
        expect(sent[0]).toEqual({
            type: 'defineName',
            value: {name: 'Sales', formula: 'Sheet1!$B$2:$B$9', sheetIdx: 0},
        })

        const again = await defineName.handler(
            {name: 'SALES', refersTo: 'Sheet1!$B$2:$B$20'},
            ctx
        )
        expect(again.data.replaced).toBe(true)

        await renameName.handler({oldName: 'SALES', newName: 'Revenue'}, ctx)
        const listed = await listNames.handler({}, ctx)
        expect(listed.data).toEqual({
            names: [{name: 'Revenue', refersTo: 'Sheet1!$B$2:$B$20'}],
        })

        await deleteName.handler({name: 'Revenue'}, ctx)
        expect(names.size).toBe(0)
    })

    it("surfaces the engine's reason when it refuses", async () => {
        const {ctx} = fakeWorkbook()
        const wb = ctx.workbook as {handleTransaction: unknown}
        wb.handleTransaction = async () => ({
            status: {type: 'err', value: 1},
            errorMessage: '"A1" is not a valid name',
        })
        await expect(
            defineName.handler({name: 'A1', refersTo: '1'}, ctx)
        ).rejects.toThrow('define_name: "A1" is not a valid name')
    })
})
