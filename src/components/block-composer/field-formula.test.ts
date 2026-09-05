import {describe, expect, it} from 'vitest'
import type {FieldSetting} from 'logisheets-core'
import {
    firstFieldFormulaError,
    referencedFieldNames,
    validateFieldFormula,
    validateValidationFormula,
} from './field-formula'

function field(
    name: string,
    valueFormula?: string,
    validation?: string
): FieldSetting {
    return {
        id: `id-${name}`,
        name,
        type: 'number',
        required: false,
        unique: false,
        primary: false,
        valueFormula,
        validation,
    } as FieldSetting
}

describe('referencedFieldNames', () => {
    it('reads names out of both quote styles and spacing variants', () => {
        expect(
            referencedFieldNames(
                `=#FIELD("qty") * #field( 'unit price' ) + #FIELD("qty")`
            )
        ).toEqual([
            {name: 'qty', keyed: false},
            {name: 'unit price', keyed: false},
            {name: 'qty', keyed: false},
        ])
    })

    it('marks the keyed form, which addresses another row', () => {
        expect(referencedFieldNames(`=#FIELD("total", "a-1")`)).toEqual([
            {name: 'total', keyed: true},
        ])
    })

    it('finds nothing in a formula with no field refs', () => {
        expect(referencedFieldNames('=#KEY & "-x"')).toEqual([])
    })
})

describe('validateFieldFormula', () => {
    const qty = field('qty')
    const price = field('price')

    it('accepts an empty formula — most fields have none', () => {
        expect(validateFieldFormula(field('total'), [qty, price])).toBeNull()
    })

    it('accepts refs to declared siblings', () => {
        const total = field('total', '=#FIELD("qty")*#FIELD("price")')
        expect(validateFieldFormula(total, [qty, price, total])).toBeNull()
    })

    it('rejects a ref to a field the block does not have', () => {
        const total = field('total', '=#FIELD("qty")*#FIELD("discount")')
        expect(validateFieldFormula(total, [qty, price, total])).toMatch(
            /discount/
        )
    })

    it('rejects an unkeyed self-reference — it resolves to this very cell', () => {
        const total = field('total', '=#FIELD("total")+1')
        expect(validateFieldFormula(total, [qty, total])).toMatch(/itself/)
    })

    it('allows a keyed self-reference — that one reaches another record', () => {
        const total = field('total', '=#FIELD("total", "a-1")+1')
        expect(validateFieldFormula(total, [qty, total])).toBeNull()
    })
})

describe('validateValidationFormula', () => {
    const qty = field('qty')

    it('accepts a rule that only uses #PLACEHOLDER', () => {
        const f = field(
            'total',
            undefined,
            'AND(#PLACEHOLDER>0,#PLACEHOLDER<10)'
        )
        expect(validateValidationFormula(f, [qty, f])).toBeNull()
    })

    it('rejects a ref to a field the block does not have', () => {
        const f = field('total', undefined, '#PLACEHOLDER<#FIELD("cap")')
        expect(validateValidationFormula(f, [qty, f])).toMatch(/cap/)
    })

    it('allows a rule to name its own field — that is not a self-loop', () => {
        // A rule is evaluated against the cell rather than computing it, so
        // `#FIELD("total")` here is just a longhand `#PLACEHOLDER`.
        const f = field('total', undefined, '#FIELD("total")>0')
        expect(validateValidationFormula(f, [qty, f])).toBeNull()
    })
})

describe('firstFieldFormulaError', () => {
    it('returns nothing when every field checks out', () => {
        const qty = field('qty')
        const total = field('total', '=#FIELD("qty")*2')
        expect(firstFieldFormulaError([qty, total])).toBeNull()
    })

    it('names the offending field so the dialog can select it', () => {
        const qty = field('qty')
        const total = field('total', '=#FIELD("nope")')
        expect(firstFieldFormulaError([qty, total])?.field.name).toBe('total')
    })

    it('catches a bad validation rule too, not just a bad value formula', () => {
        const qty = field('qty')
        const total = field('total', '=#FIELD("qty")*2', '#FIELD("nope")>0')
        const bad = firstFieldFormulaError([qty, total])
        expect(bad?.field.name).toBe('total')
        expect(bad?.message).toMatch(/nope/)
    })
})
