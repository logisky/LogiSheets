import {overlap, OverlapType, Rect} from './types'

describe('data types', () => {
    it('overlap single target partially covered', () => {
        const target = new Rect(0, 0, 10, 10)
        const cache = new Rect(0, 0, 10, 5)
        const result = overlap([target], cache)
        expect(result.ty).toEqual(OverlapType.PartiallyCovered)
        expect(result.targets).toEqual([new Rect(0, 5, 10, 5)])
    })
    it('overlap single target uncovered', () => {
        const target = new Rect(0, 0, 10, 10)
        const cache = new Rect(11, 11, 10, 5)
        const result = overlap([target], cache)
        expect(result.ty).toEqual(OverlapType.Uncovered)
        expect(result.targets.length).toEqual(1)
        expect(result.targets[0]).toEqual(target)
    })
    it('overlap multiple targets partially covered', () => {
        const targets = [new Rect(0, 0, 10, 10), new Rect(15, 15, 10, 10)]
        const cache = new Rect(5, 5, 15, 15)
        const result = overlap(targets, cache)
        expect(result.ty).toEqual(OverlapType.PartiallyCovered)
        expect(result.targets.length).toEqual(4)
    })
    it('overlap miltiple targets fully covered', () => {
        const targets = [new Rect(0, 0, 10, 10), new Rect(10, 10, 10, 10)]
        const cache = new Rect(0, 0, 20, 20)
        const result = overlap(targets, cache)
        expect(result.ty).toEqual(OverlapType.FullyCovered)
        expect(result.targets.length).toEqual(0)
    })
})
