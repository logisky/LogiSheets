import {describe, expect, it, vi} from 'vitest'
import {createCraftEventHub, createWorkbookChangeEmitter} from './events'

describe('createCraftEventHub', () => {
    it('delivers to subscribers of the event only', () => {
        const hub = createCraftEventHub()
        const locale = vi.fn()
        const workbook = vi.fn()
        hub.subscribe('locale', locale)
        hub.subscribe('workbook', workbook)
        hub.emit('locale', 'zh-CN')
        expect(locale).toHaveBeenCalledWith('zh-CN')
        expect(workbook).not.toHaveBeenCalled()
    })

    it('stops delivering after the disposer runs', () => {
        const hub = createCraftEventHub()
        const l = vi.fn()
        const dispose = hub.subscribe('locale', l)
        dispose()
        hub.emit('locale', 'en')
        expect(l).not.toHaveBeenCalled()
    })

    it('keeps going when a listener throws', () => {
        const hub = createCraftEventHub()
        const after = vi.fn()
        hub.subscribe('locale', () => {
            throw new Error('craft bug')
        })
        hub.subscribe('locale', after)
        hub.emit('locale', 'en')
        expect(after).toHaveBeenCalledOnce()
    })

    it('lets a listener unsubscribe itself mid-emit', () => {
        const hub = createCraftEventHub()
        const second = vi.fn()
        const dispose = hub.subscribe('locale', () => dispose())
        hub.subscribe('locale', second)
        hub.emit('locale', 'en')
        hub.emit('locale', 'en')
        expect(second).toHaveBeenCalledTimes(2)
    })

    it('clear drops every listener', () => {
        const hub = createCraftEventHub()
        const l = vi.fn()
        hub.subscribe('workbook', l)
        hub.clear()
        hub.emit('workbook', {version: 1})
        expect(l).not.toHaveBeenCalled()
    })
})

describe('createWorkbookChangeEmitter', () => {
    const tick = () => new Promise((r) => setTimeout(r, 0))

    it('coalesces a synchronous burst into one event', async () => {
        const emit = vi.fn()
        const e = createWorkbookChangeEmitter(async () => 7, emit)
        e.notify()
        e.notify()
        e.notify()
        await tick()
        expect(emit).toHaveBeenCalledOnce()
        expect(emit).toHaveBeenCalledWith({version: 7})
    })

    it('fires again for a change that lands while reading the version', async () => {
        let release!: (v: number) => void
        let version = 1
        const emit = vi.fn()
        const e = createWorkbookChangeEmitter(
            () =>
                version === 1
                    ? new Promise<number>((r) => (release = r))
                    : Promise.resolve(version),
            emit
        )
        e.notify()
        await tick()
        version = 2
        e.notify() // during the first read
        release(1)
        await tick()
        expect(emit.mock.calls).toEqual([[{version: 1}], [{version: 2}]])
    })

    it('still fires when the version cannot be read', async () => {
        const emit = vi.fn()
        const e = createWorkbookChangeEmitter(async () => {
            throw new Error('worker gone')
        }, emit)
        e.notify()
        await tick()
        expect(emit).toHaveBeenCalledWith({version: undefined})
    })

    it('fires separately for changes after a flush', async () => {
        let version = 3
        const emit = vi.fn()
        const e = createWorkbookChangeEmitter(async () => version, emit)
        e.notify()
        await tick()
        version = 4
        e.notify()
        await tick()
        expect(emit.mock.calls).toEqual([[{version: 3}], [{version: 4}]])
    })

    it('does not repeat a version already delivered', async () => {
        const emit = vi.fn()
        const e = createWorkbookChangeEmitter(async () => 5, emit)
        e.notify()
        await tick()
        e.notify() // the same transaction, reported again by the worker
        await tick()
        expect(emit).toHaveBeenCalledOnce()
    })
})
