// @ts-nocheck
import {TextManager} from './text'
vi.mock('@/core/standable', async (asyncImport) => {
    const mod = await asyncImport<typeof import('@/core/standable')>()
    return {
        ...mod,
        StandardFont: class StandardFont {
            setSize() {
                return this
            }
            measureText() {
                return {
                    width: 1
                }
            }
        }
    }
})

describe('text test', () => {
    let manager: TextManager
    beforeEach(() => {
        manager = new TextManager({context: {text: '1234', eof: '\n', lineHeight: () => 1}})
        vi.spyOn(manager, 'drawText').mockImplementation(() => {})
    })
    test('remove one item', () => {
        const removed = manager.remove(2, 2)
        expect(removed.length).toBe(1)
        expect(removed[0].char).toBe('3')
    })
    test('remove last', () => {
        const removed = manager.remove(3, 3)
        expect(removed.length).toBe(1)
        expect(removed[0].char).toBe('4')
    })
})