import { lcsLenMatch } from './lcs'
describe('lcs test', () => {
    it('lcsLenMatch', () => {
        const pattern = 'at'
        const beMatched = ['bath', 'banana', 'ant', 'at']
        const getValue = (beMatched: string) => beMatched
        const matchInfo = lcsLenMatch(pattern, beMatched, getValue)
        const expectedResult = [
            { beMatched: 'bath', matchedMap: new Map([[0,1], [1, 2]])},
            { beMatched: 'ant', matchedMap: new Map([[0, 0], [1, 2]])},
            { beMatched: 'at', matchedMap: new Map ([[0, 0],[1, 1 ]])},
        ]
        expect(matchInfo.length).toBe(expectedResult.length)
        expectedResult.forEach((expected, i) => {
            expect(matchInfo[i].beMatched).toBe(expected.beMatched)
            const matchInfoMapArr = Array.from(matchInfo[i].matchedMap)
            const expectedMapArr = Array.from(expected.matchedMap)
            expect(matchInfoMapArr).toEqual(expectedMapArr)
        })
    })
})