/**
 * `list_violations` is the one call that answers "is anything here
 * untrustworthy". A pivot fails in ways no validation rule can see — correct
 * numbers with whole groups missing, or a recipe that stopped resolving and
 * leaves every cell reading 0 — so if that sweep misses them, the failure this
 * whole design worries about is exactly the one nothing reports.
 */
import {describe, expect, it} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import type {ToolContext} from '../tool.js'
import {listViolations} from './inspect.js'

function ctxFor(client: Client): ToolContext {
    return {
        workbook: client,
        signal: new AbortController().signal,
        confirm: async () => true,
        log: () => {},
    }
}

/** One pivot block over a source, with the plan the engine would return. */
function clientWith(plan: unknown) {
    const blocks = [
        {
            sheetIdx: 0,
            sheetId: 7,
            blockId: 9,
            rowStart: 6,
            colStart: 0,
            rowCnt: 3,
            colCnt: 2,
            description: '',
            owner: '',
            modifyPolicy: 'all',
            permissions: {},
            fieldRenders: [],
            cells: [],
            analyzes: 3,
            analyzedBy: [],
            pivot: {
                rowDim: 'region',
                measure: 'amt',
                func: 'SUM',
                order: 'ascending',
            },
            schema: {
                name: 'sales_pivot',
                schemaType: 'row',
                keys: [{key: 'East', idx: 0}],
                // No field declares a rule, so the validation sweep finds
                // nothing — which is the case that used to report "all clear".
                fields: [
                    {
                        field: 'region',
                        idx: 0,
                        renderId: 'p0',
                        writePolicy: 'inherit',
                    },
                    {
                        field: 'amt',
                        idx: 1,
                        renderId: 'p1',
                        writePolicy: 'inherit',
                    },
                ],
                randomEntries: [],
            },
        },
    ]
    const client = {
        getAllBlocks: async () => blocks,
        getAllSheetInfo: async () => [{name: 'Sheet1'}],
        getAllBlockKeyDuplicates: async () => [],
        pivotPlan: async () => plan,
    } as unknown as Client
    return client
}

const HEALTHY = {
    keys: ['East', 'South'],
    fields: [],
    currentKeys: ['East', 'South'],
    currentFields: [],
    missingKeys: [],
    missingFields: [],
    extraKeys: [],
    extraFields: [],
    unassignedRecords: 0,
    isStale: false,
}

describe('list_violations reports pivots that cannot be taken at face value', () => {
    it('says nothing about a healthy pivot', async () => {
        const r = await listViolations.handler({}, ctxFor(clientWith(HEALTHY)))
        expect(r.data.pivots_needing_attention).toEqual([])
    })

    it('flags a STALE pivot, whose every number is right and whose table is not', async () => {
        const r = await listViolations.handler(
            {},
            ctxFor(
                clientWith({
                    ...HEALTHY,
                    keys: ['East', 'North', 'South'],
                    missingKeys: ['North'],
                    isStale: true,
                })
            )
        )
        const notes = r.data.pivots_needing_attention
        expect(notes).toHaveLength(1)
        expect(notes[0]).toMatchObject({block: 'sales_pivot', state: 'stale'})
        expect(notes[0].detail).toContain('North')
        expect(notes[0].detail).toContain('INCOMPLETE')
        expect(r.display).toContain('stale')
    })

    it('flags a BROKEN recipe rather than swallowing the plan error', async () => {
        // The plan failing IS the signal: the recipe names something the
        // source no longer has, and the cells are quietly reading 0 because a
        // BLOCKREFS matching nothing yields an empty matrix. Swallowing it
        // would leave the one failure with no symptom anywhere.
        const r = await listViolations.handler(
            {},
            ctxFor(
                clientWith({
                    msg: 'the pivot measures "amt", which block 1 does not have',
                    ty: 6,
                })
            )
        )
        const notes = r.data.pivots_needing_attention
        expect(notes).toHaveLength(1)
        expect(notes[0].state).toBe('broken')
        expect(notes[0].detail).toContain('measures "amt"')
        expect(notes[0].detail).toContain('do NOT report any number')
        expect(r.display).toContain('broken')
    })
})

/**
 * A block's OWN rule reaches the sweep too.
 *
 * `unique_together` is the first rule a block states about itself rather than
 * about one of its cells, and it lands on the same validation shadows as every
 * per-field rule — so `list_violations` finds it for free. Two things did NOT
 * come for free, and both are the reason this test exists:
 *
 *   - a field is only PROBED when it derives a rule, and a plain text column
 *     that merely belongs to a group derives none of its own. Missing that
 *     meant the cell was never looked at and the violation never found.
 *   - the shadow is one boolean over every clause ANDed together, so the label
 *     has to name every declaration that could be responsible. It named only
 *     the per-field ones, and reported a duplicate combination as "one of enum
 *     set …" — a reason that is not just unhelpful but untrue.
 */
describe('list_violations reports a block-level unique_together', () => {
    /** Two records repeat (South, Q1); neither column alone is unique. */
    const ROWS = [
        ['f0', 'East', 'Q1'],
        ['f1', 'South', 'Q1'],
        ['f2', 'South', 'Q1'],
        ['f3', 'South', 'Q2'],
    ]
    /** Which probes came back false — indexed the way the handler asks. */
    const FAILING = new Set(['1:1', '1:2', '2:1', '2:2'])

    function clientForGroups(uniqueTogether: string[][]) {
        const blocks = [
            {
                sheetIdx: 0,
                sheetId: 7,
                blockId: 3,
                rowStart: 0,
                colStart: 0,
                rowCnt: ROWS.length,
                colCnt: 3,
                description: '',
                owner: '',
                modifyPolicy: 'all',
                permissions: {},
                fieldRenders: [],
                cells: ROWS.flatMap((r) =>
                    r.map((v) => ({value: {type: 'str', value: v}}))
                ),
                analyzedBy: [],
                schema: {
                    name: 'facts',
                    schemaType: 'row',
                    keys: ROWS.map((r, i) => ({key: r[0], idx: i})),
                    // Plain text, no per-field rule anywhere: the group is the
                    // only thing that makes these cells worth looking at.
                    fields: [
                        {
                            field: 'id',
                            idx: 0,
                            renderId: 'u0',
                            writePolicy: 'inherit',
                        },
                        {
                            field: 'region',
                            idx: 1,
                            renderId: 'u1',
                            writePolicy: 'inherit',
                        },
                        {
                            field: 'quarter',
                            idx: 2,
                            renderId: 'u2',
                            writePolicy: 'inherit',
                        },
                    ],
                    randomEntries: [],
                    uniqueTogether: uniqueTogether.map((g) => ({fields: g})),
                },
            },
        ]
        return {
            getAllBlocks: async () => blocks,
            getAllSheetInfo: async () => [{name: 'Sheet1'}],
            getAllBlockKeyDuplicates: async () => [],
            // The engine's shadows, stubbed: false exactly on the duplicated
            // combination's cells.
            getShadowCellIds: async (p: {rowIdx: number[]; colIdx: number[]}) =>
                p.rowIdx.map((r, i) => ({
                    cellId: {
                        type: 'ephemeralCell',
                        value: r * 10 + p.colIdx[i],
                    },
                })),
            batchGetCellInfoById: async (p: {
                ids: {cellId: {value: number}}[]
            }) =>
                p.ids.map((id) => {
                    const n = id.cellId.value
                    const key = `${Math.floor(n / 10)}:${n % 10}`
                    return {
                        value: {type: 'bool', value: !FAILING.has(key)},
                    }
                }),
        } as unknown as Client
    }

    it('probes a field that only a GROUP gives a rule to', async () => {
        const r = await listViolations.handler(
            {},
            ctxFor(clientForGroups([['region', 'quarter']]))
        )
        expect(r.data.violations).toHaveLength(4)
        expect(r.data.violations.map((v) => `${v.row_key}!${v.field}`)).toEqual(
            ['f1!region', 'f1!quarter', 'f2!region', 'f2!quarter']
        )
    })

    it('names the group as the reason, not some other declaration', async () => {
        const r = await listViolations.handler(
            {},
            ctxFor(clientForGroups([['region', 'quarter']]))
        )
        expect(r.data.violations[0].rule).toBe(
            'unique together with (region, quarter)'
        )
    })

    it('looks at nothing when no group names the field', async () => {
        const r = await listViolations.handler({}, ctxFor(clientForGroups([])))
        expect(r.data.violations).toEqual([])
        expect(r.display).toContain('No validation rules declared in scope')
    })
})
