import {
    isA1notation,
    toA1notation,
    toZeroBasedNotation,
    parseA1notation,
} from './a1notation'

describe('a1notation test', () => {
    it('to a1notation', () => {
        const result = toA1notation(10)
        expect(result).toBe('K')
    })
    it('toZeroBasedNotation' ,() => {
        const r1 = toZeroBasedNotation('K')
        expect(r1).toBe(10)
        const r2 = toZeroBasedNotation('a')
        expect(r2).toBe(0)
    })
    it('isA1notation', () => {
        const r1 = isA1notation(1)
        expect(r1).toBeFalsy()
        const r2 = isA1notation('A')
        expect(r2).toBeFalsy()
        const r3 = isA1notation('A1')
        expect(r3).toBeTruthy()
    })
    it('parse', () => {
        const r1 = parseA1notation('a1')
        expect(r1!.cs).toBe(0)
        expect(r1!.rs).toBe(0)
        expect(r1!.ce).toBeUndefined()
        expect(r1!.re).toBeUndefined()
        const r2 = parseA1notation('a1:b2')
        expect(r2!.cs).toBe(0)
        expect(r2!.rs).toBe(0)
        expect(r2!.ce).toBe(1)
        expect(r2!.re).toBe(1)
    })
})