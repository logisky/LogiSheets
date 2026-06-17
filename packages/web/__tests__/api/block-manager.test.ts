import {describe, it, expect, vi} from 'vitest'
import {BlockManager} from '../../src/api/block_manager'

describe('BlockManager', () => {
    it('delegates bindBlock to the injected checker', () => {
        const checkBindBlock = vi.fn().mockReturnValue(true)
        const getAvailableBlockId = vi.fn().mockReturnValue(100)
        const manager = new BlockManager(checkBindBlock, getAvailableBlockId)

        expect(manager.bindBlock(0, 1, 2, 3)).toBe(true)
        expect(checkBindBlock).toHaveBeenCalledWith(0, 1, 2, 3)
    })

    it('returns available ids and increments per sheet', () => {
        const checkBindBlock = vi.fn()
        const getAvailableBlockId = vi.fn().mockReturnValue(10)
        const manager = new BlockManager(checkBindBlock, getAvailableBlockId)

        // First call seeds the cache with 10 and returns it; subsequent calls
        // return the cached value and then bump it.
        expect(manager.getAvailableBlockId(0)).toBe(10)
        expect(manager.getAvailableBlockId(0)).toBe(10)
        expect(manager.getAvailableBlockId(0)).toBe(11)
        expect(getAvailableBlockId).toHaveBeenCalledTimes(1)
        expect(getAvailableBlockId).toHaveBeenCalledWith(0)
    })

    it('tracks separate counters per sheet', () => {
        const checkBindBlock = vi.fn()
        const getAvailableBlockId = vi
            .fn()
            .mockReturnValueOnce(5)
            .mockReturnValueOnce(20)
        const manager = new BlockManager(checkBindBlock, getAvailableBlockId)

        expect(manager.getAvailableBlockId(0)).toBe(5)
        expect(manager.getAvailableBlockId(1)).toBe(20)
        expect(manager.getAvailableBlockId(0)).toBe(5)
        expect(manager.getAvailableBlockId(1)).toBe(20)
    })

    it('returns false when bindBlock checker returns false', () => {
        const checkBindBlock = vi.fn().mockReturnValue(false)
        const getAvailableBlockId = vi.fn()
        const manager = new BlockManager(checkBindBlock, getAvailableBlockId)

        expect(manager.bindBlock(0, 1, 1, 1)).toBe(false)
    })
})
