import {
    DEFAULT_FORM,
    dateToFormula,
    formToSpec,
    formulaToDate,
    formulaToSource,
    formulaToTime,
    sourceToFormula,
    specToForm,
    timeToFormula,
    type DvForm,
} from './form'

const form = (o: Partial<DvForm>): DvForm => ({...DEFAULT_FORM, ...o})

describe('list sources', () => {
    it('quotes typed options the way Excel stores them', () => {
        expect(sourceToFormula('Yes, No ,  Maybe')).toBe('"Yes,No,Maybe"')
        expect(sourceToFormula('say "hi", bye')).toBe('"say ""hi"",bye"')
    })

    it('keeps a reference as a reference', () => {
        expect(sourceToFormula('=$D$1:$D$5')).toBe('$D$1:$D$5')
        expect(formulaToSource('$D$1:$D$5')).toBe('=$D$1:$D$5')
    })

    it('reads back what it wrote', () => {
        expect(formulaToSource(sourceToFormula('a, b "c"'))).toBe('a, b "c"')
    })
})

describe('dates and times', () => {
    it('turns ISO dates and clock times into DATE/TIME', () => {
        expect(dateToFormula('2026-1-31')).toBe('DATE(2026,1,31)')
        expect(formulaToDate('DATE(2026,1,31)')).toBe('2026-01-31')
        expect(timeToFormula('9:05')).toBe('TIME(9,5,0)')
        expect(formulaToTime('TIME(9,5,0)')).toBe('09:05')
        expect(formulaToTime('TIME(9,5,30)')).toBe('09:05:30')
    })

    it('passes a formula through', () => {
        expect(dateToFormula('=TODAY()')).toBe('TODAY()')
        expect(formulaToDate('TODAY()')).toBe('TODAY()')
    })
})

describe('formToSpec', () => {
    it('clears the rule for "Any value"', () => {
        expect(formToSpec(form({allow: 'any'}))).toEqual({spec: null})
    })

    it('names what is missing', () => {
        expect(formToSpec(form({allow: 'list'}))).toEqual({
            error: 'ui.dv.err.source',
        })
        expect(
            formToSpec(form({allow: 'whole', operator: 'between', value1: '1'}))
        ).toEqual({error: 'ui.dv.err.value2'})
        expect(formToSpec(form({allow: 'custom'}))).toEqual({
            error: 'ui.dv.err.formula',
        })
    })

    it('sends no operator for a list or a custom rule', () => {
        const r = formToSpec(form({allow: 'list', source: 'a,b'}))
        expect('spec' in r && r.spec?.operator).toBe('')
    })

    it('round-trips through the spec', () => {
        const f = form({
            allow: 'date',
            operator: 'between',
            value1: '2026-01-01',
            value2: '2026-12-31',
            errorStyle: 'warning',
            error: 'This year only',
            prompt: 'A date in 2026',
        })
        const r = formToSpec(f)
        if (!('spec' in r) || !r.spec) throw new Error('expected a spec')
        expect(r.spec.formula1).toBe('DATE(2026,1,1)')
        expect(specToForm(r.spec)).toEqual(f)
    })
})
