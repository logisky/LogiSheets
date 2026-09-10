import {describe, expect, it} from 'vitest'
import type {BlockSchemaFieldEntry} from 'logisheets-web/pure'
import {projectBlockFields} from './field-projection'

/**
 * The projection is what makes the schema the single source of truth for what a
 * field is. Before it, the widget layer resolved each field against a host-side
 * store restored from an opaque AppData blob — and skipped rendering the whole
 * block when any field failed to resolve, so a table converted from a foreign
 * .xlsx drew as nothing until a placeholder pass papered over it.
 */

function field(over: Partial<BlockSchemaFieldEntry>): BlockSchemaFieldEntry {
    return {
        field: 'f',
        idx: 0,
        renderId: 'r0',
        required: false,
        unique: false,
        writePolicy: 'inherit',
        ...over,
    } as BlockSchemaFieldEntry
}

function block(
    fields: BlockSchemaFieldEntry[],
    renders: Array<{renderId: string; style?: {formatter: string}}> = []
) {
    return {
        sheetId: 7,
        blockId: 3,
        fieldRenders: renders as never,
        schema: {
            name: 'orders',
            schemaType: 'row',
            keys: [],
            fields,
            randomEntries: [],
        } as never,
    }
}

describe('projectBlockFields', () => {
    it('projects every field of the schema, in field-axis order', () => {
        // No host store at all. Every field still resolves, which is the whole
        // point — there is no "skip the block" case left.
        const out = projectBlockFields(
            block([
                field({field: 'b', idx: 1, renderId: 'r1'}),
                field({field: 'a', idx: 0, renderId: 'r0'}),
            ])
        )
        expect(out.map((f) => f.name)).toEqual(['a', 'b'])
        expect(out.map((f) => f.id)).toEqual(['r0', 'r1'])
        expect(out.every((f) => f.sheetId === 7 && f.blockId === 3)).toBe(true)
        expect(out.every((f) => f.refName === 'orders')).toBe(true)
    })

    it('carries the declaration across', () => {
        const [f] = projectBlockFields(
            block([
                field({
                    field: 'code',
                    fieldType: {kind: 'string'} as never,
                    description: 'never reused',
                    required: true,
                    unique: true,
                    defaultValue: '-',
                    validationFormula: 'LEN(#PLACEHOLDER)>2',
                }),
            ])
        )
        expect(f.type).toEqual({
            type: 'string',
            validation: 'LEN(#PLACEHOLDER)>2',
        })
        expect(f.description).toBe('never reused')
        expect(f.required).toBe(true)
        expect(f.unique).toBe(true)
        expect(f.defaultValue).toBe('-')
    })

    it('takes the number format from the render info, not the declaration', () => {
        // A formatter is how the value is DRAWN, so it lives with the render
        // info; the declaration says only that the field holds a number.
        const [f] = projectBlockFields(
            block(
                [field({fieldType: {kind: 'number'} as never})],
                [{renderId: 'r0', style: {formatter: '0.00%'}}]
            )
        )
        expect(f.type).toEqual({
            type: 'number',
            validation: '',
            formatter: '0.00%',
        })
    })

    it('rebuilds the payload of an enum and of a reference', () => {
        const out = projectBlockFields(
            block([
                field({
                    field: 'state',
                    idx: 0,
                    renderId: 'r0',
                    fieldType: {kind: 'enum', enumSetId: 'status'} as never,
                }),
                field({
                    field: 'customer',
                    idx: 1,
                    renderId: 'r1',
                    fieldType: {
                        kind: 'fieldRef',
                        refSheetId: 2,
                        refBlockId: 9,
                        refFieldName: 'code',
                    } as never,
                }),
            ])
        )
        expect(out[0].type).toEqual({type: 'enum', id: 'status'})
        expect(out[1].type).toEqual({
            type: 'fieldRef',
            sheetId: 2,
            blockId: 9,
            fieldName: 'code',
            validation: '',
        })
    })

    it('reads an undeclared field as free-form rather than guessing', () => {
        // A block from before the declaration existed, or one converted from
        // plain cells. This is the case that used to make the renderer bail.
        const [f] = projectBlockFields(block([field({})]))
        expect(f.type).toEqual({type: 'unspecified'})
        expect(f.required).toBe(false)
        expect(f.description).toBeUndefined()
    })

    it('translates the declared write policy into the tri-state flag', () => {
        // Every reader downstream speaks the boolean, so the translation
        // happens once, here. `ownerOnly` closes the field, `anyone` opens it
        // against the block's own rules.
        const out = projectBlockFields(
            block([
                field({idx: 0, renderId: 'r0', writePolicy: 'ownerOnly'}),
                field({idx: 1, renderId: 'r1', writePolicy: 'anyone'}),
                field({idx: 2, renderId: 'r2', writePolicy: 'inherit'}),
            ])
        )
        expect(out.map((f) => f.userEditable)).toEqual([false, true, undefined])
    })

    it('returns nothing for a block with no schema', () => {
        const out = projectBlockFields({
            sheetId: 1,
            blockId: 1,
            fieldRenders: [],
            schema: undefined,
        })
        expect(out).toEqual([])
    })
})
