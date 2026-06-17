import {describe, it, expect} from 'vitest'
import {toA1notation} from '../src/utils'

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
