// @ts-nocheck
import {Cursor} from './cursor'
import {TextManager} from './text'
import {vi} from 'vitest'

// Mock browser globals for Node.js test environment
Object.defineProperty(global, 'window', {
    value: {
        devicePixelRatio: 1,
    },
    writable: true,
})

Object.defineProperty(global, 'document', {
    value: {
        createElement: vi.fn(() => ({
            getContext: vi.fn(() => ({
                scale: vi.fn(),
                measureText: vi.fn(() => ({
                    width: 8,
                    actualBoundingBoxAscent: 10,
                    actualBoundingBoxDescent: 2,
                    actualBoundingBoxLeft: 0,
                    actualBoundingBoxRight: 8,
                    alphabeticBaseline: 0,
                    emHeightAscent: 10,
                    emHeightDescent: 2,
                    fontBoundingBoxAscent: 12,
                    fontBoundingBoxDescent: 3,
                    hangingBaseline: 8,
                    ideographicBaseline: -2,
                })),
            })),
            width: 0,
            height: 0,
        })),
    },
    writable: true,
})

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
                    width: 1,
                }
            }
            toCssFont() {
                return '12px Arial'
            }
        },
    }
})

describe('cursor test', () => {
    test('_getCursorInOneLine', () => {
        const cursor = new Cursor({
            textManager: new TextManager({
                context: {
                    text: '123\n456',
                    eof: '\n',
                },
            }),
        })
        cursor.column = 2
        expect(cursor.cursorPosition).toBe(2)

        cursor.lineNumber = 1
        cursor.column = 1
        expect(cursor.cursorPosition).toBe(5)
    })
    test('type', () => {
        const cursor = new Cursor({
            textManager: new TextManager({
                context: {
                    text: '1234',
                    eof: '\n',
                },
            }),
        })
        cursor.column = 1
        cursor.x = 1
        cursor.type(1, [])
        expect(cursor.column).toBe(2)
        // expect(cursor.x).toBe(6)
    })

    test('updatePosition', () => {
        const cursor = new Cursor({
            textManager: new TextManager({
                context: {
                    text: '123456789',
                    eof: '\n',
                },
            }),
        })
        cursor.updatePosition(1)
        expect(cursor.column).toBe(1)
    })
})
