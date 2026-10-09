import {describe, expect, it} from 'vitest'
import type {Client} from '../port.js'
import {WorkbookOps} from './index.js'

/**
 * A client over a sheet whose lines are all 10 units tall except the
 * `hidden` ones, which take no space — the only thing `unhideLines` reads.
 */
function opsOver(hidden: ReadonlySet<number>): {
    ops: WorkbookOps
    shown: () => number[]
    queries: () => number
} {
    const committed: Array<{type: string; value: Record<string, unknown>}> = []
    let queries = 0
    const offset = (line: number) => {
        let o = 0
        for (let i = 0; i < line; i++) if (!hidden.has(i)) o += 10
        return o
    }
    const client = {
        getCellPosition: async ({row}: {row: number}) => {
            queries++
            return {x: 0, y: offset(row)}
        },
        handleTransaction: async ({
            transaction,
        }: {
            transaction: {payloads: Array<{type: string; value: unknown}>}
        }) => {
            for (const p of transaction.payloads)
                committed.push(
                    p as {type: string; value: Record<string, unknown>}
                )
            return {status: {type: 'ok'}, taskIdx: [], asyncTasks: []}
        },
    } as unknown as Client
    return {
        ops: new WorkbookOps(client),
        shown: () =>
            committed
                .filter((p) => p.type === 'setVisible' && p.value.visible)
                .map((p) => p.value.start as number),
        queries: () => queries,
    }
}

const range = (lo: number, hi: number) =>
    Array.from({length: hi - lo + 1}, (_, i) => lo + i)

describe('WorkbookOps.setLinesVisible', () => {
    it('sends one payload per line, in either order, as one transaction', async () => {
        const {ops} = opsOver(new Set())
        const sent: unknown[] = []
        ;(ops as unknown as {client: Client}).client.handleTransaction =
            (async ({transaction}: {transaction: {payloads: unknown[]}}) => {
                sent.push(transaction.payloads)
                return {status: {type: 'ok'}}
            }) as unknown as Client['handleTransaction']
        await ops.setLinesVisible(2, 'col', 6, 4, false)
        expect(sent).toEqual([
            [4, 5, 6].map((start) => ({
                type: 'setVisible',
                value: {isRow: false, sheetIdx: 2, start, visible: false},
            })),
        ])
    })
})

describe('WorkbookOps.unhideLines', () => {
    it('shows just the selection when nothing beside it is hidden', async () => {
        const {ops, shown} = opsOver(new Set([0, 9]))
        await ops.unhideLines(0, 'row', 3, 5)
        expect(shown()).toEqual([3, 4, 5])
    })

    it('extends over hidden runs on both sides', async () => {
        const {ops, shown} = opsOver(new Set([4, 5, 6, 10, 11]))
        await ops.unhideLines(0, 'row', 7, 9)
        expect(shown()).toEqual(range(4, 11))
    })

    it('reaches a run that starts at the sheet edge', async () => {
        const {ops, shown} = opsOver(new Set([0, 1, 2]))
        await ops.unhideLines(0, 'row', 3, 3)
        expect(shown()).toEqual(range(0, 3))
    })

    it('bisects a long run instead of walking it', async () => {
        const hidden = new Set(range(101, 1100))
        const {ops, shown, queries} = opsOver(hidden)
        await ops.unhideLines(0, 'row', 100, 100)
        expect(shown()).toEqual(range(100, 1100))
        expect(queries()).toBeLessThan(60)
    })
})
