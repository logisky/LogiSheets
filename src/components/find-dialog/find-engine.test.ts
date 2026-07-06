import type {Value} from 'logisheets-web'
import {
    buildMatcher,
    findAdjacentIndex,
    valueToSearchString,
    type FindMatch,
    type FindOptions,
} from './find-engine'

const OPTS = (o: Partial<FindOptions> = {}): FindOptions => ({
    matchCase: false,
    wholeCell: false,
    useRegex: false,
    ...o,
})

describe('valueToSearchString', () => {
    const cases: [Value, string][] = [
        ['empty', ''],
        [{type: 'str', value: 'hello'}, 'hello'],
        [{type: 'number', value: 12.5}, '12.5'],
        [{type: 'bool', value: true}, 'TRUE'],
        [{type: 'bool', value: false}, 'FALSE'],
        [{type: 'error', value: '#REF!'}, '#REF!'],
    ]
    cases.forEach(([value, expected]) => {
        it(`converts ${JSON.stringify(value)}`, () => {
            expect(valueToSearchString(value)).toBe(expected)
        })
    })
})

describe('buildMatcher', () => {
    it('substring, case-insensitive by default', () => {
        const m = buildMatcher('app', OPTS())
        expect(m('Apple')).toBe(true)
        expect(m('banana')).toBe(false)
    })

    it('respects matchCase', () => {
        const m = buildMatcher('app', OPTS({matchCase: true}))
        expect(m('Apple')).toBe(false)
        expect(m('an app')).toBe(true)
    })

    it('wholeCell requires full equality', () => {
        const m = buildMatcher('apple', OPTS({wholeCell: true}))
        expect(m('Apple')).toBe(true) // case-insensitive
        expect(m('apple pie')).toBe(false)
    })

    it('wholeCell + matchCase', () => {
        const m = buildMatcher('Apple', OPTS({wholeCell: true, matchCase: true}))
        expect(m('Apple')).toBe(true)
        expect(m('apple')).toBe(false)
    })

    it('regex, case-insensitive', () => {
        const m = buildMatcher('a.+e', OPTS({useRegex: true}))
        expect(m('APPLE')).toBe(true)
        expect(m('xyz')).toBe(false)
    })

    it('regex + wholeCell anchors the pattern', () => {
        const m = buildMatcher('\\d+', OPTS({useRegex: true, wholeCell: true}))
        expect(m('123')).toBe(true)
        expect(m('a123')).toBe(false)
    })

    it('throws on invalid regex', () => {
        expect(() => buildMatcher('[', OPTS({useRegex: true}))).toThrow()
    })
})

describe('findAdjacentIndex', () => {
    const matches: FindMatch[] = [
        {row: 0, col: 0},
        {row: 0, col: 5},
        {row: 2, col: 1},
    ]

    it('returns -1 for an empty list', () => {
        expect(findAdjacentIndex([], {row: 0, col: 0}, 'next')).toBe(-1)
    })

    it('next: first match at or after the anchor', () => {
        expect(findAdjacentIndex(matches, {row: 0, col: 0}, 'next')).toBe(0)
        expect(findAdjacentIndex(matches, {row: 0, col: 1}, 'next')).toBe(1)
        expect(findAdjacentIndex(matches, {row: 1, col: 0}, 'next')).toBe(2)
    })

    it('next: wraps to the top when past the end', () => {
        expect(findAdjacentIndex(matches, {row: 9, col: 9}, 'next')).toBe(0)
    })

    it('prev: last match at or before the anchor', () => {
        expect(findAdjacentIndex(matches, {row: 0, col: 0}, 'prev')).toBe(0)
        expect(findAdjacentIndex(matches, {row: 0, col: 4}, 'prev')).toBe(0)
        expect(findAdjacentIndex(matches, {row: 2, col: 9}, 'prev')).toBe(2)
    })

    it('prev: wraps to the bottom when before the start', () => {
        expect(findAdjacentIndex(matches, {row: 0, col: -1} as FindMatch, 'prev')).toBe(2)
    })
})
