import {describe, it, expect, afterEach} from 'vitest'
import {SHORTCUTS, matchShortcut, dispatchShortcut} from './shortcuts'

/**
 * The bindings table is where key conflicts hide: two specs that can both match
 * one event, or a chord that silently shadows another (Ctrl+PageDown switching
 * sheets vs. bare PageDown paging, Ctrl+= zooming vs. Ctrl+Alt+= AutoSum).
 * These tests pin the resolutions down.
 */

// matchShortcut only reads these five fields off the event.
type KeyInit = {
    key: string
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
}

const ev = (init: KeyInit) =>
    ({
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        ...init,
    }) as KeyboardEvent

/**
 * The primary modifier is ⌘ on Apple and Ctrl elsewhere, decided from
 * `navigator` at match time. Pin the platform so the expectations are stable
 * wherever the suite runs.
 */
function setPlatform(platform: string) {
    Object.defineProperty(globalThis, 'navigator', {
        value: {platform, userAgent: platform},
        configurable: true,
        writable: true,
    })
}

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

afterEach(() => {
    if (originalNavigator)
        Object.defineProperty(globalThis, 'navigator', originalNavigator)
})

describe('the bindings table', () => {
    it('has no duplicate ids', () => {
        const ids = SHORTCUTS.map((s) => s.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})

describe('matchShortcut (non-Apple: Ctrl is primary)', () => {
    const setup = () => setPlatform('Win32')

    it('pages with the bare keys and switches sheets with Ctrl', () => {
        setup()
        expect(matchShortcut(ev({key: 'PageDown'}))).toBe('pageDown')
        expect(matchShortcut(ev({key: 'PageUp'}))).toBe('pageUp')
        expect(matchShortcut(ev({key: 'PageDown', ctrlKey: true}))).toBe('nextSheet')
        expect(matchShortcut(ev({key: 'PageUp', ctrlKey: true}))).toBe('prevSheet')
    })

    it('keeps Shift+Page on the paging binding (it extends the selection)', () => {
        setup()
        expect(matchShortcut(ev({key: 'PageDown', shiftKey: true}))).toBe('pageDown')
    })

    it('separates Home, Ctrl+Home and Ctrl+End', () => {
        setup()
        expect(matchShortcut(ev({key: 'Home'}))).toBe('rowStart')
        expect(matchShortcut(ev({key: 'Home', ctrlKey: true}))).toBe('sheetStart')
        expect(matchShortcut(ev({key: 'End', ctrlKey: true}))).toBe('sheetEnd')
        // Shift extends rather than moving, so it must not change the binding.
        expect(matchShortcut(ev({key: 'Home', shiftKey: true}))).toBe('rowStart')
        expect(matchShortcut(ev({key: 'Home', ctrlKey: true, shiftKey: true}))).toBe(
            'sheetStart'
        )
        expect(matchShortcut(ev({key: 'End', ctrlKey: true, shiftKey: true}))).toBe(
            'sheetEnd'
        )
    })

    it('leaves bare End unbound (Excel uses it as a mode toggle we do not have)', () => {
        setup()
        expect(matchShortcut(ev({key: 'End'}))).toBeNull()
    })

    it('routes arrows to move, jump, and their Shift-extending variants', () => {
        setup()
        expect(matchShortcut(ev({key: 'ArrowDown'}))).toBe('moveDown')
        expect(matchShortcut(ev({key: 'ArrowDown', shiftKey: true}))).toBe('moveDown')
        expect(matchShortcut(ev({key: 'ArrowDown', ctrlKey: true}))).toBe('jumpDown')
        expect(
            matchShortcut(ev({key: 'ArrowDown', ctrlKey: true, shiftKey: true}))
        ).toBe('jumpDown')
    })

    it('inserts and deletes lines on the Alt chords (Google Sheets style)', () => {
        setup()
        expect(matchShortcut(ev({key: '=', ctrlKey: true, altKey: true}))).toBe(
            'insertLines'
        )
        expect(matchShortcut(ev({key: '-', ctrlKey: true, altKey: true}))).toBe(
            'deleteLines'
        )
        // Layout spellings: Shift+'=' gives '+', the numpad gives '+' / '-'
        // directly, and macOS turns Option+'=' / Option+'-' into '≠' / '–'.
        expect(
            matchShortcut(ev({key: '+', ctrlKey: true, altKey: true, shiftKey: true}))
        ).toBe('insertLines')
        expect(matchShortcut(ev({key: '≠', ctrlKey: true, altKey: true}))).toBe(
            'insertLines'
        )
        expect(matchShortcut(ev({key: '–', ctrlKey: true, altKey: true}))).toBe(
            'deleteLines'
        )
        expect(matchShortcut(ev({key: '_', ctrlKey: true, altKey: true}))).toBe(
            'deleteLines'
        )
    })

    it('leaves zoom on its usual chords — Alt is what separates them', () => {
        setup()
        expect(matchShortcut(ev({key: '=', ctrlKey: true}))).toBe('zoomIn')
        // '+' is Shift+'=' on most layouts, and the numpad reports '+' directly.
        expect(matchShortcut(ev({key: '+', ctrlKey: true, shiftKey: true}))).toBe(
            'zoomIn'
        )
        expect(matchShortcut(ev({key: '-', ctrlKey: true}))).toBe('zoomOut')
        expect(matchShortcut(ev({key: '-', ctrlKey: true, shiftKey: true}))).toBe(
            'zoomOut'
        )
        expect(matchShortcut(ev({key: '0', ctrlKey: true}))).toBe('zoomReset')
    })

    it('keeps AutoSum on the bare Alt+= chord Excel uses', () => {
        setup()
        expect(matchShortcut(ev({key: '=', altKey: true}))).toBe('autoSum')
    })

    it('binds fill down / right', () => {
        setup()
        expect(matchShortcut(ev({key: 'd', ctrlKey: true}))).toBe('fillDown')
        expect(matchShortcut(ev({key: 'r', ctrlKey: true}))).toBe('fillRight')
        // CapsLock reports an uppercase key with Shift up.
        expect(matchShortcut(ev({key: 'D', ctrlKey: true}))).toBe('fillDown')
    })

    it('ignores the Cmd chords that belong to Apple platforms', () => {
        setup()
        expect(matchShortcut(ev({key: 'd', metaKey: true}))).toBeNull()
    })
})

describe('matchShortcut (Apple: ⌘ is primary)', () => {
    it('reads ⌘ as the primary modifier and ignores Ctrl chords', () => {
        setPlatform('MacIntel')
        expect(matchShortcut(ev({key: 'd', metaKey: true}))).toBe('fillDown')
        expect(matchShortcut(ev({key: '=', metaKey: true, altKey: true}))).toBe(
            'insertLines'
        )
        expect(matchShortcut(ev({key: 'Home', metaKey: true}))).toBe('sheetStart')
        expect(matchShortcut(ev({key: 'PageDown', metaKey: true}))).toBe('nextSheet')
        expect(matchShortcut(ev({key: 'd', ctrlKey: true}))).toBeNull()
    })

    it('still pages on the bare keys', () => {
        setPlatform('MacIntel')
        expect(matchShortcut(ev({key: 'PageDown'}))).toBe('pageDown')
    })
})

describe('dispatchShortcut', () => {
    it('runs the handler for a matched binding and reports it handled', () => {
        setPlatform('Win32')
        let called: string | null = null
        const handled = dispatchShortcut(ev({key: 'PageDown'}), {
            pageDown: () => (called = 'pageDown'),
        })
        expect(handled).toBe(true)
        expect(called).toBe('pageDown')
    })

    it('passes the event through so handlers can branch on Shift', () => {
        setPlatform('Win32')
        let shift: boolean | null = null
        dispatchShortcut(ev({key: 'ArrowDown', shiftKey: true}), {
            moveDown: (e) => (shift = e.shiftKey),
        })
        expect(shift).toBe(true)
    })

    it('falls through when the matched binding has no handler', () => {
        setPlatform('Win32')
        // An unhandled shortcut must NOT be reported handled — the caller uses
        // that to decide whether to preventDefault, so swallowing it here would
        // silently kill the browser's own behavior.
        expect(dispatchShortcut(ev({key: 'PageDown'}), {})).toBe(false)
    })

    it('falls through when nothing matches', () => {
        setPlatform('Win32')
        expect(dispatchShortcut(ev({key: 'F7'}), {pageDown: () => {}})).toBe(false)
    })
})
