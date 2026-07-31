import {describe, it, expect} from 'vitest'
import type {Value} from 'logisheets-engine'
import {inferFields, looksLikeDateFormat, type InferCell} from './infer'

const str = (value: string): InferCell => ({value: {type: 'str', value}})
const num = (value: number, numFmt = ''): InferCell => ({
    value: {type: 'number', value},
    numFmt,
})
const bool = (value: boolean): InferCell => ({value: {type: 'bool', value}})
const empty: InferCell = {value: 'empty' as Value}

describe('looksLikeDateFormat', () => {
    it('detects date/time formats and rejects plain numeric ones', () => {
        expect(looksLikeDateFormat('yyyy-mm-dd')).toBe(true)
        expect(looksLikeDateFormat('m/d/yyyy')).toBe(true)
        expect(looksLikeDateFormat('h:mm:ss')).toBe(true)
        expect(looksLikeDateFormat('0.00')).toBe(false)
        expect(looksLikeDateFormat('#,##0')).toBe(false)
        expect(looksLikeDateFormat('')).toBe(false)
        // A quoted literal with letters must not be mistaken for a date.
        expect(looksLikeDateFormat('0" units"')).toBe(false)
    })
})

describe('inferFields', () => {
    it('uses the first row as names when it labels typed columns', () => {
        const grid = [
            [str('Name'), str('Age')],
            [str('Alice'), num(30)],
            [str('Bob'), num(25)],
        ]
        const {fields, hasHeader} = inferFields(grid)
        expect(hasHeader).toBe(true)
        expect(fields.map((f) => f.name)).toEqual(['Name', 'Age'])
        expect(fields.map((f) => f.type)).toEqual(['string', 'number'])
        expect(fields[0].primary).toBe(true)
        expect(fields[1].primary).toBe(false)
    })

    it('treats an all-text region as data (no header) to avoid dropping a row', () => {
        const grid = [
            [str('red'), str('apple')],
            [str('green'), str('pear')],
        ]
        const {fields, hasHeader} = inferFields(grid)
        expect(hasHeader).toBe(false)
        expect(fields.map((f) => f.name)).toEqual(['Field 1', 'Field 2'])
        expect(fields.every((f) => f.type === 'string')).toBe(true)
    })

    it('infers datetime from a date number format and boolean from bools', () => {
        const grid = [
            [str('When'), str('Active')],
            [num(45000, 'yyyy-mm-dd'), bool(true)],
            [num(45001, 'yyyy-mm-dd'), bool(false)],
        ]
        const {fields, hasHeader} = inferFields(grid)
        expect(hasHeader).toBe(true)
        expect(fields.map((f) => f.type)).toEqual(['datetime', 'boolean'])
    })

    it('falls back to string for a mixed number/text column', () => {
        const grid = [
            [str('Code'), str('Qty')],
            [str('A1'), num(5)],
            [num(2), num(6)],
        ]
        const {fields} = inferFields(grid)
        // Col 0 mixes text + number → string; col 1 stays number.
        expect(fields.map((f) => f.type)).toEqual(['string', 'number'])
    })

    it('ignores empty cells when inferring a column type', () => {
        const grid = [
            [str('Score')],
            [num(10)],
            [empty],
            [num(20)],
        ]
        const {fields} = inferFields(grid)
        expect(fields[0].type).toBe('number')
    })

    it('handles an empty grid', () => {
        expect(inferFields([])).toEqual({fields: [], hasHeader: false})
    })
})
