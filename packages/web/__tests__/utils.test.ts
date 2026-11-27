import {describe, it, expect} from 'vitest'
import {numberToText, toA1notation} from '../src/utils'

describe('toA1notation', () => {
    it('converts single-letter columns', () => {
        expect(toA1notation(0)).toBe('A')
        expect(toA1notation(25)).toBe('Z')
    })

    it('converts two-letter columns', () => {
        expect(toA1notation(26)).toBe('AA')
        expect(toA1notation(27)).toBe('AB')
        expect(toA1notation(51)).toBe('AZ')
        expect(toA1notation(52)).toBe('BA')
        expect(toA1notation(701)).toBe('ZZ')
    })

    it('converts three-letter columns', () => {
        expect(toA1notation(702)).toBe('AAA')
        expect(toA1notation(703)).toBe('AAB')
        expect(toA1notation(16383)).toBe('XFD')
    })

    it('throws for negative indices', () => {
        expect(() => toA1notation(-1)).toThrow(
            "Invalid column index '-1'. Must be a non-negative integer."
        )
    })

    it('throws for non-integer indices', () => {
        expect(() => toA1notation(1.5)).toThrow(
            "Invalid column index '1.5'. Must be a non-negative integer."
        )
    })

    it('throws for unsafe integers', () => {
        expect(() => toA1notation(Number.MAX_SAFE_INTEGER + 1)).toThrow()
    })
})

describe('numberToText', () => {
    it('drops floating-point tails a spreadsheet never shows', () => {
        expect(numberToText(0.1 + 0.2)).toBe('0.3')
        expect(numberToText(1 - 0.9)).toBe('0.1')
        expect(numberToText(1.1 * 1.1)).toBe('1.21')
        expect(numberToText(100 * 1.1)).toBe('110')
        expect(numberToText(0.7 + 0.1)).toBe('0.8')
        // 0.19999999999999929: its 15-digit form is what Excel's formula
        // bar shows too (the cell shows 0.2 — that is General's width rule).
        expect(numberToText(10.2 - 10)).toBe('0.199999999999999')
    })

    it('keeps 15 significant digits, like the engine', () => {
        // Same cases as number_text.rs's tests.
        expect(numberToText(1 / 3)).toBe('0.333333333333333')
        expect(numberToText(2 / 3)).toBe('0.666666666666667')
        expect(numberToText(Math.SQRT2)).toBe('1.4142135623731')
        expect(numberToText(-1 / 3)).toBe('-0.333333333333333')
    })

    it('leaves what was already right alone', () => {
        for (const [n, s] of [
            [1, '1'],
            [1.5, '1.5'],
            [0.25, '0.25'],
            [1234.5678, '1234.5678'],
            [-42, '-42'],
            [0, '0'],
            [123456789012345, '123456789012345'],
        ] as const)
            expect(numberToText(n)).toBe(s)
    })

    it('does not touch huge or non-finite values', () => {
        expect(numberToText(1e20)).toBe(String(1e20))
        expect(numberToText(Infinity)).toBe('Infinity')
        expect(numberToText(NaN)).toBe('NaN')
    })
})
