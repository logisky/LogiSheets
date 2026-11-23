import {describe, it, expect, afterEach} from 'vitest'
import {
    SHORTCUTS,
    HOST_SHORTCUTS,
    matchShortcut,
    dispatchShortcut,
    shortcutLabel,
} from './shortcuts'

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

const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator'
)

afterEach(() => {
    if (originalNavigator)
        Object.defineProperty(globalThis, 'navigator', originalNavigator)
})

describe('the bindings table', () => {
    it('binds each id at most once per keymap', () => {
        for (const keymap of ['web', 'excel'] as const) {
            const ids = SHORTCUTS.filter(
                (s) => !s.keymap || s.keymap === keymap
            ).map((s) => s.id)
            expect(new Set(ids).size).toBe(ids.length)
        }
    })

    it('gives every host shortcut a binding in the excel keymap', () => {
        setPlatform('Win32')
        for (const id of HOST_SHORTCUTS)
            expect(shortcutLabel(id, 'excel')).not.toBe('')
    })
})

describe('matchShortcut (excel keymap, non-Apple)', () => {
    const m = (init: KeyInit) => matchShortcut(ev(init), 'excel')
    const setup = () => setPlatform('Win32')

    it('inserts on Ctrl++ and deletes on Ctrl+-, as Excel does', () => {
        setup()
        // Shift+'=' reports '+'; the numpad '+' reports it with Shift up.
        expect(m({key: '+', ctrlKey: true, shiftKey: true})).toBe('insertLines')
        expect(m({key: '+', ctrlKey: true})).toBe('insertLines')
        expect(m({key: '-', ctrlKey: true})).toBe('deleteLines')
        // Bare Ctrl+= is unbound in Excel, and Ctrl+Shift+- is its
        // "remove borders", so neither may reach insert / delete.
        expect(m({key: '=', ctrlKey: true})).toBeNull()
        expect(m({key: '_', ctrlKey: true, shiftKey: true})).toBeNull()
    })

    it('moves zoom onto the Alt chords', () => {
        setup()
        expect(m({key: '=', ctrlKey: true, altKey: true})).toBe('zoomIn')
        expect(m({key: '-', ctrlKey: true, altKey: true})).toBe('zoomOut')
        expect(m({key: '0', ctrlKey: true, altKey: true})).toBe('zoomReset')
    })

    it('hides with Ctrl+9 / Ctrl+0 and unhides with Shift added', () => {
        setup()
        expect(m({key: '9', ctrlKey: true})).toBe('hideRows')
        expect(m({key: '0', ctrlKey: true})).toBe('hideColumns')
        // A US layout reports the shifted digits as '(' / ')'.
        expect(m({key: '(', ctrlKey: true, shiftKey: true})).toBe('unhideRows')
        expect(m({key: ')', ctrlKey: true, shiftKey: true})).toBe(
            'unhideColumns'
        )
    })

    it('binds Ctrl+T to convert to block', () => {
        setup()
        expect(m({key: 't', ctrlKey: true})).toBe('convertToBlock')
    })

    it('keeps the bindings both keymaps share', () => {
        setup()
        expect(m({key: 'd', ctrlKey: true})).toBe('fillDown')
        expect(m({key: '=', altKey: true})).toBe('autoSum')
        expect(m({key: ' ', ctrlKey: true})).toBe('selectColumns')
        expect(m({key: ' ', shiftKey: true})).toBe('selectRows')
        expect(m({key: 'F11', shiftKey: true})).toBe('newSheet')
    })

    it('labels the Excel spellings', () => {
        setup()
        expect(shortcutLabel('insertLines', 'excel')).toBe('Ctrl++')
        expect(shortcutLabel('insertLines', 'web')).toBe('Ctrl+Alt+=')
        expect(shortcutLabel('selectColumns')).toBe('Ctrl+Space')
        expect(shortcutLabel('hideRows', 'web')).toBe('')
    })
})

describe('matchShortcut (non-Apple: Ctrl is primary)', () => {
    const setup = () => setPlatform('Win32')

    it('pages with the bare keys and switches sheets with Ctrl', () => {
        setup()
        expect(matchShortcut(ev({key: 'PageDown'}))).toBe('pageDown')
        expect(matchShortcut(ev({key: 'PageUp'}))).toBe('pageUp')
        expect(matchShortcut(ev({key: 'PageDown', ctrlKey: true}))).toBe(
            'nextSheet'
        )
        expect(matchShortcut(ev({key: 'PageUp', ctrlKey: true}))).toBe(
            'prevSheet'
        )
    })

    it('keeps Shift+Page on the paging binding (it extends the selection)', () => {
        setup()
        expect(matchShortcut(ev({key: 'PageDown', shiftKey: true}))).toBe(
            'pageDown'
        )
    })

    it('binds Ctrl+K to insert link, and bare K to nothing', () => {
        setup()
        expect(matchShortcut(ev({key: 'k', ctrlKey: true}))).toBe(
            'insertHyperlink'
        )
        expect(matchShortcut(ev({key: 'k'}))).toBeNull()
    })

    it('separates Home, Ctrl+Home and Ctrl+End', () => {
        setup()
        expect(matchShortcut(ev({key: 'Home'}))).toBe('rowStart')
        expect(matchShortcut(ev({key: 'Home', ctrlKey: true}))).toBe(
            'sheetStart'
        )
        expect(matchShortcut(ev({key: 'End', ctrlKey: true}))).toBe('sheetEnd')
        // Shift extends rather than moving, so it must not change the binding.
        expect(matchShortcut(ev({key: 'Home', shiftKey: true}))).toBe(
            'rowStart'
        )
        expect(
            matchShortcut(ev({key: 'Home', ctrlKey: true, shiftKey: true}))
        ).toBe('sheetStart')
        expect(
            matchShortcut(ev({key: 'End', ctrlKey: true, shiftKey: true}))
        ).toBe('sheetEnd')
    })

    it('leaves bare End unbound (Excel uses it as a mode toggle we do not have)', () => {
        setup()
        expect(matchShortcut(ev({key: 'End'}))).toBeNull()
    })

    it('routes arrows to move, jump, and their Shift-extending variants', () => {
        setup()
        expect(matchShortcut(ev({key: 'ArrowDown'}))).toBe('moveDown')
        expect(matchShortcut(ev({key: 'ArrowDown', shiftKey: true}))).toBe(
            'moveDown'
        )
        expect(matchShortcut(ev({key: 'ArrowDown', ctrlKey: true}))).toBe(
            'jumpDown'
        )
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
            matchShortcut(
                ev({key: '+', ctrlKey: true, altKey: true, shiftKey: true})
            )
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
        expect(
            matchShortcut(ev({key: '+', ctrlKey: true, shiftKey: true}))
        ).toBe('zoomIn')
        expect(matchShortcut(ev({key: '-', ctrlKey: true}))).toBe('zoomOut')
        expect(
            matchShortcut(ev({key: '-', ctrlKey: true, shiftKey: true}))
        ).toBe('zoomOut')
        expect(matchShortcut(ev({key: '0', ctrlKey: true}))).toBe('zoomReset')
    })

    it('leaves the chords a browser keeps for itself unbound', () => {
        setup()
        expect(matchShortcut(ev({key: 't', ctrlKey: true}))).toBeNull()
        expect(matchShortcut(ev({key: '9', ctrlKey: true}))).toBeNull()
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
        expect(matchShortcut(ev({key: 'Home', metaKey: true}))).toBe(
            'sheetStart'
        )
        expect(matchShortcut(ev({key: 'PageDown', metaKey: true}))).toBe(
            'nextSheet'
        )
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
        expect(dispatchShortcut(ev({key: 'F7'}), {pageDown: () => {}})).toBe(
            false
        )
    })
})

describe('matchShortcut (Excel chords shared by both keymaps)', () => {
    const setup = () => setPlatform('Win32')
    const both = (init: KeyInit) =>
        (['web', 'excel'] as const).map((k) => matchShortcut(ev(init), k))

    it('binds the Ctrl+Shift number formats, US symbol or bare digit', () => {
        setup()
        const cases: [string, string, string][] = [
            ['~', '`', 'numFmtGeneral'],
            ['!', '1', 'numFmtNumber'],
            ['@', '2', 'numFmtTime'],
            ['#', '3', 'numFmtDate'],
            ['$', '4', 'numFmtCurrency'],
            ['%', '5', 'numFmtPercent'],
            ['^', '6', 'numFmtScientific'],
        ]
        for (const [symbol, digit, id] of cases)
            for (const key of [symbol, digit])
                expect(both({key, ctrlKey: true, shiftKey: true})).toEqual([
                    id,
                    id,
                ])
    })

    it('keeps their unshifted neighbours on their own bindings', () => {
        setup()
        expect(both({key: '1', ctrlKey: true})).toEqual([
            'formatCells',
            'formatCells',
        ])
        expect(both({key: '`', ctrlKey: true})).toEqual([
            'toggleFormulas',
            'toggleFormulas',
        ])
        expect(both({key: ';', ctrlKey: true, shiftKey: true})).toEqual([
            'insertTime',
            'insertTime',
        ])
    })

    it('binds Replace to the Control key itself, even on macOS', () => {
        setup()
        expect(both({key: 'h', ctrlKey: true})).toEqual(['replace', 'replace'])
        // ⌘H hides the app on macOS, so Mac Excel's ⌃H is the binding there.
        setPlatform('MacIntel')
        expect(both({key: 'h', ctrlKey: true})).toEqual(['replace', 'replace'])
        expect(both({key: 'h', metaKey: true})).toEqual([null, null])
    })

    it('binds Shift+F2 to add a comment, and leaves bare F2 editing', () => {
        setup()
        expect(both({key: 'F2', shiftKey: true})).toEqual([
            'addComment',
            'addComment',
        ])
        expect(both({key: 'F2'})).toEqual(['editCell', 'editCell'])
    })
})
