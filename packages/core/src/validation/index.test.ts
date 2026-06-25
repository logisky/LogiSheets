import {describe, it, expect} from 'vitest'
import {interpretValidation, checkValidations} from './index.js'

const rule = {sheetIdx: 0, row: 0, col: 0, formula: 'A1>0'}

describe('interpretValidation', () => {
    it('passes on bool true', () => {
        expect(
            interpretValidation(rule, {type: 'bool', value: true} as never)
        ).toBeNull()
    })
    it('fails on bool false', () => {
        expect(
            interpretValidation(rule, {type: 'bool', value: false} as never)
                ?.kind
        ).toBe('failed')
    })
    it('skips empty (object form)', () => {
        expect(interpretValidation(rule, {type: 'empty'} as never)).toBeNull()
    })
    it("skips empty (engine's literal-string form)", () => {
        expect(interpretValidation(rule, 'empty' as never)).toBeNull()
    })
    it('reports formula error', () => {
        const v = interpretValidation(rule, {
            type: 'error',
            value: '#NAME?',
        } as never)
        expect(v?.kind).toBe('error')
        expect(v?.message).toContain('#NAME?')
    })
})

describe('checkValidations', () => {
    it('collects only the violating cells', () => {
        const values: Record<string, unknown> = {
            'A1>0': {type: 'bool', value: true},
            'A2>0': {type: 'bool', value: false},
        }
        const rules = [
            {sheetIdx: 0, row: 0, col: 0, formula: 'A1>0'},
            {sheetIdx: 0, row: 1, col: 0, formula: 'A2>0'},
        ]
        const out = checkValidations(
            rules,
            (_s: number, f: string) => values[f] as never
        )
        expect(out).toHaveLength(1)
        expect(out[0].row).toBe(1)
    })
})
