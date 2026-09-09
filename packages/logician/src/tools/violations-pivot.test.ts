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
