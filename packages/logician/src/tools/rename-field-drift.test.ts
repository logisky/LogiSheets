/**
 * Stage 0 evidence for design/block-field-semantics.md: renaming a field does
 * not carry the `unique` constraint with it.
 *
 * A field's semantics live in the host (`FieldInfo.unique`), and the host
 * lowers them into the schema by composing a formula
 * (src/components/block-composer/index.tsx):
 *
 *     COUNTIF(BLOCKREFSB(sheet, block, "*", "fieldName"), #PLACEHOLDER) = 1
 *
 * The field name appears there as BLOCKREFSB's fourth argument — a runtime
 * string. `rename_field` rewrites only the `#FIELD("old")` shape, and its
 * "another block mentions this name, refuse" guard skips the block itself, so
 * the composed rule is neither rewritten nor caught.
 *
 * The engine-side half of this is pinned by
 * `a_blockrefs_naming_a_field_that_does_not_exist_matches_nothing` in
 * crates/controller/src/api/test.rs: a dead field name matches nothing, COUNTIF
 * returns 0, and `= 1` is FALSE — so the whole column shows a validation
 * warning and every write to it counts as violating.
 *
 * These assertions describe today's behaviour, not the desired one. When the
 * engine generates the unique check from the schema (stage 2), the rename
 * regenerates it and this test flips.
 */
import {describe, expect, it} from 'vitest'
import type {Client} from 'logisheets-web/pure'
import type {ToolContext} from '../tool.js'
import {renameField} from './builder.js'

const SHEET_ID = 7
const BLOCK_ID = 3

/** The rule the host composes for a `unique` field named `email`. */
const UNIQUE_RULE = `COUNTIF(BLOCKREFSB(${SHEET_ID}, ${BLOCK_ID}, "*", "email"), #PLACEHOLDER) = 1`

/**
 * One block, `orders`, whose `email` field is unique (composed rule above) and
 * whose `label` field reads `email` through the `#FIELD("…")` form — so the
 * test can watch the two shapes being treated differently.
 */
function blockClient() {
    const committed: Array<{type: string; value: Record<string, unknown>}> = []
    const client = {
        getAllBlocks: async () => [
            {
                sheetIdx: 0,
                sheetId: SHEET_ID,
                blockId: BLOCK_ID,
                rowStart: 0,
                colStart: 0,
                rowCnt: 2,
                colCnt: 3,
                description: '',
                owner: '',
                modifyPolicy: 'all',
                permissions: {},
                fieldRenders: [],
                cells: [],
                schema: {
                    name: 'orders',
                    schemaType: 'row',
                    keys: [{key: 'k1', idx: 0}],
                    fields: [
                        {field: 'id', idx: 0, renderId: 'r0'},
                        {
                            field: 'email',
                            idx: 1,
                            renderId: 'r1',
                            validationFormula: UNIQUE_RULE,
                            // The declaration the composed rule above is the
                            // lowering of. Stage 1 put it on the schema.
                            fieldType: {kind: 'string'},
                            description: 'billing contact',
                            unique: true,
                        },
                        {
                            field: 'label',
                            idx: 2,
                            renderId: 'r2',
                            valueFormula: 'UPPER(#FIELD("email"))',
                        },
                    ],
                    randomEntries: [],
                },
            },
        ],
        getAllSheetInfo: async () => [{name: 'Sheet1'}],
        mayModifyBlock: async () => true,
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
    return {client, committed}
}

function ctxFor(client: Client): ToolContext {
    return {
        workbook: client,
        signal: new AbortController().signal,
        confirm: async () => true,
        log: () => {},
    }
}

describe('build__rename_field drops the unique constraint on the floor', () => {
    it('rewrites #FIELD("old") but leaves the composed unique rule naming the old field', async () => {
        const {client, committed} = blockClient()

        await renameField.handler(
            {block: 'orders', from: 'email', to: 'contact'},
            ctxFor(client)
        )

        const bind = committed.find((p) => p.type === 'bindFormSchema')
        expect(bind, 'the rename re-binds the schema').toBeDefined()
        const value = bind!.value as {
            fields: Array<{
                name: string
                valueFormula?: string
                validationFormula?: string
                unique?: boolean
                description?: string
            }>
        }

        // The parts rename_field knows about move correctly.
        expect(value.fields.map((f) => f.name)).toEqual([
            'id',
            'contact',
            'label',
        ])
        expect(value.fields[2].valueFormula).toBe('UPPER(#FIELD("contact"))')

        // And the declaration survives the round trip through the snapshot.
        // It would be very easy for a rename to wipe it — the snapshot is
        // re-bound wholesale, so anything the snapshot shape omits is gone.
        expect(value.fields[1].unique).toBe(true)
        expect(value.fields[1].description).toBe('billing contact')

        // The part rename_field still does not know about: the composed unique
        // check names `email`, a field the block no longer has. Nothing refused
        // the rename, and nothing warned.
        //
        // This is what stage 2 fixes at the root — the engine generates the
        // unique check from `unique: true` above, so a rename regenerates it
        // and there is no baked-in name left to go stale.
        const rule = value.fields[1].validationFormula
        expect(rule).toContain('"email"')
        expect(rule).not.toContain('"contact"')
        expect(rule).toBe(UNIQUE_RULE)
    })
})
