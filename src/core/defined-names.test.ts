import {describe, expect, it} from 'vitest'
import {parseNameRange, rangeRefersTo} from './defined-names'

describe('rangeRefersTo', () => {
    it('writes an absolute, sheet-qualified range', () => {
        expect(
            rangeRefersTo({
                sheetName: 'Sheet1',
                startRow: 1,
                startCol: 1,
                endRow: 9,
                endCol: 2,
            })
        ).toBe('Sheet1!$B$2:$C$10')
    })
    it('writes one cell without a colon, quoting the sheet', () => {
        expect(
            rangeRefersTo({
                sheetName: 'My Sheet',
                startRow: 0,
                startCol: 0,
                endRow: 0,
                endCol: 0,
            })
        ).toBe("'My Sheet'!$A$1")
    })
})

describe('parseNameRange', () => {
    it('reads what rangeRefersTo writes', () => {
        const r = {
            sheetName: "Bob's data",
            startRow: 3,
            startCol: 27,
            endRow: 40,
            endCol: 28,
        }
        expect(parseNameRange(rangeRefersTo(r))).toEqual(r)
    })
    it('accepts relative refs, a leading = and a reversed rectangle', () => {
        expect(parseNameRange('=Data!C5:A1')).toEqual({
            sheetName: 'Data',
            startRow: 0,
            startCol: 0,
            endRow: 4,
            endCol: 2,
        })
    })
    it('is undefined for constants and expressions', () => {
        expect(parseNameRange('0.08')).toBeUndefined()
        expect(parseNameRange('Sheet1!$A$1*12')).toBeUndefined()
        expect(parseNameRange('A1:B2')).toBeUndefined()
    })
})
