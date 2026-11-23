// Keyboard shortcut registry for the spreadsheet grid.
//
// Definitions live here, decoupled from Spreadsheet.svelte: the component only
// builds a `ShortcutHandlers` map and calls `dispatchShortcut(e, handlers)` in
// its keydown handler. Handlers are intentionally left as stubs for now — fill
// them in as features land.
//
// Modifier handling: Excel's "Ctrl+X" maps to Cmd+X on macOS. We treat the
// platform's command key (⌘ on Apple, Ctrl elsewhere) as the single "primary"
// modifier, so one definition covers both platforms.

/** True on macOS / iPadOS / iOS, where ⌘ is the primary modifier. */
export function isApplePlatform(): boolean {
    if (typeof navigator === 'undefined') return false
    const p =
        // @ts-expect-error userAgentData is not in every lib.dom yet
        navigator.userAgentData?.platform ?? navigator.platform ?? ''
    return /mac|iphone|ipad|ipod/i.test(p)
}

/** Is the platform's primary modifier (⌘ on Apple, Ctrl elsewhere) held? */
export function primaryPressed(e: KeyboardEvent): boolean {
    return isApplePlatform() ? e.metaKey : e.ctrlKey
}

/**
 * All key bindings the grid knows about — both Ctrl/⌘ chords and the bare
 * navigation/edit keys. Handlers are keyed by these ids, so every keyboard
 * action lives in one place. (The "type any printable char to start editing"
 * behavior is the one binding that can't be a fixed key, so it stays inline in
 * the component as a fallback.)
 */
export type ShortcutId =
    // Navigation / editing (no modifier)
    | 'moveUp'
    | 'moveDown'
    | 'moveLeft'
    | 'moveRight'
    | 'enter'
    | 'tab'
    | 'editCell'
    | 'clearCell'
    | 'jumpUp'
    | 'jumpDown'
    | 'jumpLeft'
    | 'jumpRight'
    // Sheet navigation
    | 'nextSheet'
    | 'prevSheet'
    // Page / Home / End navigation
    | 'pageUp'
    | 'pageDown'
    | 'rowStart'
    | 'sheetStart'
    | 'sheetEnd'
    // Ctrl/⌘ chords
    | 'copy'
    | 'cut'
    | 'paste'
    | 'pasteSpecial'
    | 'undo'
    | 'redo'
    | 'save'
    | 'selectAll'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'fillDown'
    | 'fillRight'
    | 'find'
    | 'replace'
    | 'insertHyperlink'
    | 'formatCells'
    | 'insertDate'
    | 'insertTime'
    | 'autoSum'
    | 'toggleFormulas'
    | 'insertLines'
    | 'deleteLines'
    // Whole-line selection
    | 'selectRows'
    | 'selectColumns'
    // Hide / unhide the selected lines
    | 'hideRows'
    | 'hideColumns'
    | 'unhideRows'
    | 'unhideColumns'
    | 'convertToBlock'
    | 'newSheet'
    | 'addComment'
    // Number formats (Ctrl+Shift+~ ! @ # $ % ^)
    | 'numFmtGeneral'
    | 'numFmtNumber'
    | 'numFmtTime'
    | 'numFmtDate'
    | 'numFmtCurrency'
    | 'numFmtPercent'
    | 'numFmtScientific'
    // Canvas zoom
    | 'zoomIn'
    | 'zoomOut'
    | 'zoomReset'

/**
 * Which set of bindings is active. `'web'` stays off the chords a browser
 * keeps for itself (Ctrl+T, Ctrl+9, Ctrl+=/- page zoom) and borrows Google
 * Sheets' spellings instead. `'excel'` is for a host with no browser chrome
 * around it (the desktop app), where every chord is ours to take, so it
 * spells them the way Excel does.
 */
export type Keymap = 'web' | 'excel'

/**
 * Shortcuts whose action belongs to the host: the grid has no dialog, block
 * composer, sheet tabs, comment UI or file handling of its own, so for these
 * it only reports the intent (with the selection it applies to) and the host
 * acts on it.
 */
export const HOST_SHORTCUTS = [
    'save',
    'formatCells',
    'autoSum',
    'convertToBlock',
    'hideRows',
    'hideColumns',
    'unhideRows',
    'unhideColumns',
    'newSheet',
    'addComment',
    'toggleFormulas',
    'replace',
    'numFmtGeneral',
    'numFmtNumber',
    'numFmtTime',
    'numFmtDate',
    'numFmtCurrency',
    'numFmtPercent',
    'numFmtScientific',
] as const satisfies readonly ShortcutId[]

export type HostShortcutId = (typeof HOST_SHORTCUTS)[number]

/** `true`/`false` require the modifier up/down; `'any'` ignores it. */
type ModReq = boolean | 'any'

interface ShortcutSpec {
    id: ShortcutId
    /**
     * Only active under this keymap. Omitted means both. An id may appear
     * once per keymap, so the two can bind the same action to different keys.
     */
    keymap?: Keymap
    /** Human-readable label, e.g. shown in menus / tooltips. */
    description: string
    /** `KeyboardEvent.key` value(s) to match, compared case-insensitively. */
    key: string | readonly string[]
    /** Requires the primary modifier (⌘ / Ctrl). Default false. */
    primary?: boolean
    /**
     * Requires the Control key itself on every platform, in place of
     * `primary`. For the few chords macOS keeps for itself under ⌘ — ⌘H hides
     * the app before the page sees it — where Mac Excel uses ⌃ instead.
     */
    ctrl?: boolean
    /** Shift requirement. Default false (Shift must be up); `'any'` ignores. */
    shift?: ModReq
    /** Alt / Option requirement. Default false; `'any'` ignores. */
    alt?: ModReq
}

// Every key binding, in one table. `key` uses KeyboardEvent.key values.
// Display strings (Ctrl vs ⌘) are derived per-platform by `shortcutLabel`.
export const SHORTCUTS: readonly ShortcutSpec[] = [
    // ---- Navigation / editing (bare keys) ----
    // Arrows move the selection; with Shift they extend it from the anchor
    // (the handler reads shiftKey — see Spreadsheet's extendSelection).
    {id: 'moveUp', description: 'Move up', key: 'ArrowUp', shift: 'any'},
    {id: 'moveDown', description: 'Move down', key: 'ArrowDown', shift: 'any'},
    {id: 'moveLeft', description: 'Move left', key: 'ArrowLeft', shift: 'any'},
    {
        id: 'moveRight',
        description: 'Move right',
        key: 'ArrowRight',
        shift: 'any',
    },
    // Enter/Tab move; the handler reads Shift to pick the direction.
    {id: 'enter', description: 'Confirm / move', key: 'Enter', shift: 'any'},
    {id: 'tab', description: 'Next / previous cell', key: 'Tab', shift: 'any'},
    {id: 'editCell', description: 'Edit cell', key: 'F2'},
    {
        id: 'clearCell',
        description: 'Clear cell',
        key: ['Delete', 'Backspace'],
    },
    // Ctrl/⌘+Arrow: jump to the next data/block boundary; with Shift, extend
    // the selection out to it instead.
    {
        id: 'jumpUp',
        description: 'Jump to boundary up',
        key: 'ArrowUp',
        primary: true,
        shift: 'any',
    },
    {
        id: 'jumpDown',
        description: 'Jump to boundary down',
        key: 'ArrowDown',
        primary: true,
        shift: 'any',
    },
    {
        id: 'jumpLeft',
        description: 'Jump to boundary left',
        key: 'ArrowLeft',
        primary: true,
        shift: 'any',
    },
    {
        id: 'jumpRight',
        description: 'Jump to boundary right',
        key: 'ArrowRight',
        primary: true,
        shift: 'any',
    },
    // Ctrl/⌘+PageDown / PageUp: switch to the next / previous sheet (Excel /
    // Google Sheets convention). The grid captures these while focused, so the
    // browser's own tab switch is suppressed only when you're in the sheet.
    {
        id: 'nextSheet',
        description: 'Next sheet',
        key: 'PageDown',
        primary: true,
    },
    {
        id: 'prevSheet',
        description: 'Previous sheet',
        key: 'PageUp',
        primary: true,
    },
    // The BARE page keys move a screen within the sheet (Ctrl/⌘ switches
    // sheets, just above). Home goes to the start of the row, Ctrl/⌘+Home to
    // A1 and Ctrl/⌘+End to the last used cell. Shift is 'any' throughout —
    // every one of these extends the selection instead when it's held.
    {id: 'pageUp', description: 'Page up', key: 'PageUp', shift: 'any'},
    {id: 'pageDown', description: 'Page down', key: 'PageDown', shift: 'any'},
    {
        id: 'rowStart',
        description: 'Go to start of row',
        key: 'Home',
        shift: 'any',
    },
    {
        id: 'sheetStart',
        description: 'Go to first cell',
        key: 'Home',
        primary: true,
        shift: 'any',
    },
    {
        id: 'sheetEnd',
        description: 'Go to last used cell',
        key: 'End',
        primary: true,
        shift: 'any',
    },
    // ---- Ctrl/⌘ chords ----
    {id: 'copy', description: 'Copy', key: 'c', primary: true},
    {id: 'cut', description: 'Cut', key: 'x', primary: true},
    {id: 'paste', description: 'Paste', key: 'v', primary: true},
    {
        id: 'pasteSpecial',
        description: 'Paste Special',
        key: 'v',
        primary: true,
        shift: true,
    },
    {id: 'undo', description: 'Undo', key: 'z', primary: true},
    {id: 'redo', description: 'Redo', key: 'y', primary: true},
    {id: 'save', description: 'Save', key: 's', primary: true},
    {id: 'selectAll', description: 'Select all', key: 'a', primary: true},
    {id: 'bold', description: 'Bold', key: 'b', primary: true},
    {id: 'italic', description: 'Italic', key: 'i', primary: true},
    {id: 'underline', description: 'Underline', key: 'u', primary: true},
    {id: 'fillDown', description: 'Fill down', key: 'd', primary: true},
    {id: 'fillRight', description: 'Fill right', key: 'r', primary: true},
    {id: 'find', description: 'Find', key: 'f', primary: true},
    {id: 'replace', description: 'Replace', key: 'h', ctrl: true},
    {
        id: 'insertHyperlink',
        description: 'Insert link',
        key: 'k',
        primary: true,
    },
    {id: 'formatCells', description: 'Format cells', key: '1', primary: true},
    {id: 'insertDate', description: 'Insert date', key: ';', primary: true},
    {
        id: 'insertTime',
        description: 'Insert time',
        key: ';',
        primary: true,
        shift: true,
    },
    // AutoSum is Alt+`=` in Excel — no Ctrl. Spelling it that way also keeps
    // Ctrl/⌘+Alt+`=` free for the insert binding below. macOS types Option+`=`
    // as `≠`.
    {id: 'autoSum', description: 'AutoSum', key: ['=', '≠'], alt: true},
    {
        id: 'toggleFormulas',
        description: 'Show formulas',
        key: '`',
        primary: true,
    },
    // ---- Whole-line selection ----
    // Ctrl/⌘+Space selects the columns of the selection, Shift+Space its
    // rows — Excel and Google Sheets agree on these.
    {
        id: 'selectColumns',
        description: 'Select columns',
        key: ' ',
        primary: true,
    },
    {id: 'selectRows', description: 'Select rows', key: ' ', shift: true},
    // Shift+F11 is Excel's "insert worksheet"; no browser claims it.
    {id: 'newSheet', description: 'New sheet', key: 'F11', shift: true},
    {id: 'addComment', description: 'Add comment', key: 'F2', shift: true},

    // ---- Number formats: Ctrl/⌘+Shift+~ ! @ # $ % ^ ----
    // A US layout reports the shifted symbol; other layouts put those
    // symbols elsewhere, so the digit (or backtick) each sits on is accepted
    // too. On macOS ⌘⇧3 / ⌘⇧4 are the system's screenshot keys and never
    // reach the page.
    {
        id: 'numFmtGeneral',
        description: 'General format',
        key: ['~', '`'],
        primary: true,
        shift: true,
    },
    {
        id: 'numFmtNumber',
        description: 'Number format',
        key: ['!', '1'],
        primary: true,
        shift: true,
    },
    {
        id: 'numFmtTime',
        description: 'Time format',
        key: ['@', '2'],
        primary: true,
        shift: true,
    },
    {
        id: 'numFmtDate',
        description: 'Date format',
        key: ['#', '3'],
        primary: true,
        shift: true,
    },
    {
        id: 'numFmtCurrency',
        description: 'Currency format',
        key: ['$', '4'],
        primary: true,
        shift: true,
    },
    {
        id: 'numFmtPercent',
        description: 'Percent format',
        key: ['%', '5'],
        primary: true,
        shift: true,
    },
    {
        id: 'numFmtScientific',
        description: 'Scientific format',
        key: ['^', '6'],
        primary: true,
        shift: true,
    },

    // ---- Insert / delete rows and columns, and zoom ----
    // The two keymaps trade these chords. A browser zooms the page on
    // Ctrl/⌘+`=`/`-`/`0`, so the web keymap leaves zoom there and moves insert
    // / delete onto the Alt chords, as Google Sheets does. Excel is the other
    // way round: Ctrl+`+` / Ctrl+`-` insert and delete, and zoom takes Alt.
    // `+` is Shift+`=` on most layouts and its own key on the numpad; macOS
    // turns Option+`=` / `-` / `0` into `≠` / `–` / `º`, so those spellings
    // are listed too.
    {
        id: 'insertLines',
        keymap: 'web',
        description: 'Insert rows / columns',
        key: ['=', '+', '≠'],
        primary: true,
        alt: true,
        shift: 'any',
    },
    {
        id: 'deleteLines',
        keymap: 'web',
        description: 'Delete rows / columns',
        key: ['-', '_', '–', '—'],
        primary: true,
        alt: true,
        shift: 'any',
    },
    // Shift is ignored because `+` is Shift+`=` on most layouts, and the numpad
    // keys report '+' / '-' directly. Alt defaults to false here, so the
    // insert / delete specs above (which require it) can never also match.
    {
        id: 'zoomIn',
        keymap: 'web',
        description: 'Zoom in',
        key: ['=', '+'],
        primary: true,
        shift: 'any',
    },
    {
        id: 'zoomOut',
        keymap: 'web',
        description: 'Zoom out',
        key: ['-', '_'],
        primary: true,
        shift: 'any',
    },
    {
        id: 'zoomReset',
        keymap: 'web',
        description: 'Reset zoom',
        key: '0',
        primary: true,
    },
    // Excel: Ctrl+`+` (Shift+`=`, or the numpad `+`) inserts and Ctrl+`-`
    // deletes. Bare Ctrl+`=` is left unbound, as it is in Excel.
    {
        id: 'insertLines',
        keymap: 'excel',
        description: 'Insert rows / columns',
        key: '+',
        primary: true,
        shift: 'any',
    },
    // Shift must stay up: Ctrl+Shift+`-` is Excel's "remove borders".
    {
        id: 'deleteLines',
        keymap: 'excel',
        description: 'Delete rows / columns',
        key: '-',
        primary: true,
    },
    {
        id: 'zoomIn',
        keymap: 'excel',
        description: 'Zoom in',
        key: ['=', '+', '≠'],
        primary: true,
        alt: true,
        shift: 'any',
    },
    {
        id: 'zoomOut',
        keymap: 'excel',
        description: 'Zoom out',
        key: ['-', '_', '–', '—'],
        primary: true,
        alt: true,
        shift: 'any',
    },
    // Excel has no reset chord; Ctrl+0 hides columns there (below), so reset
    // joins the other zoom keys on Alt.
    {
        id: 'zoomReset',
        keymap: 'excel',
        description: 'Reset zoom',
        key: ['0', 'º'],
        primary: true,
        alt: true,
    },

    // ---- Excel-only chords a browser keeps for itself ----
    // Ctrl+T opens a tab and Ctrl+9 jumps to the last tab in every browser,
    // and the page never sees them, so these exist only where there is no
    // browser around the grid.
    {
        id: 'convertToBlock',
        keymap: 'excel',
        description: 'Convert to block',
        key: 't',
        primary: true,
    },
    {
        id: 'hideRows',
        keymap: 'excel',
        description: 'Hide rows',
        key: '9',
        primary: true,
    },
    {
        id: 'hideColumns',
        keymap: 'excel',
        description: 'Hide columns',
        key: '0',
        primary: true,
    },
    // With Shift held, a US layout reports '(' / ')' for 9 / 0.
    {
        id: 'unhideRows',
        keymap: 'excel',
        description: 'Unhide rows',
        key: ['9', '('],
        primary: true,
        shift: true,
    },
    {
        id: 'unhideColumns',
        keymap: 'excel',
        description: 'Unhide columns',
        key: ['0', ')'],
        primary: true,
        shift: true,
    },
]

function modOk(pressed: boolean, req: ModReq | undefined): boolean {
    return req === 'any' ? true : pressed === !!req
}

function matches(
    e: KeyboardEvent,
    spec: ShortcutSpec,
    keymap: Keymap
): boolean {
    if (spec.keymap && spec.keymap !== keymap) return false
    const keys = Array.isArray(spec.key) ? spec.key : [spec.key]
    if (!keys.some((k) => k.toLowerCase() === e.key.toLowerCase())) return false
    if (spec.ctrl) {
        if (!e.ctrlKey || e.metaKey) return false
    } else if (primaryPressed(e) !== !!spec.primary) return false
    if (!modOk(e.shiftKey, spec.shift)) return false
    if (!modOk(e.altKey, spec.alt)) return false
    return true
}

/** The shortcut a key event maps to under `keymap`, or null. */
export function matchShortcut(
    e: KeyboardEvent,
    keymap: Keymap = 'web'
): ShortcutId | null {
    return SHORTCUTS.find((s) => matches(e, s, keymap))?.id ?? null
}

/** A handler per shortcut. All optional — unhandled shortcuts fall through. */
export type ShortcutHandlers = Partial<
    Record<ShortcutId, (e: KeyboardEvent) => void>
>

/**
 * If `e` matches a shortcut that has a handler, run it and return true (the
 * caller should then stop further key processing). Returns false when nothing
 * matched or the matched shortcut has no handler.
 */
export function dispatchShortcut(
    e: KeyboardEvent,
    handlers: ShortcutHandlers,
    keymap: Keymap = 'web'
): boolean {
    const id = matchShortcut(e, keymap)
    if (!id) return false
    const handler = handlers[id]
    if (!handler) return false
    handler(e)
    return true
}

/**
 * Platform-aware display label, e.g. "⌘C" on Mac, "Ctrl+C" on Windows. Empty
 * when `id` has no binding under `keymap`.
 */
export function shortcutLabel(id: ShortcutId, keymap: Keymap = 'web'): string {
    const spec = SHORTCUTS.find(
        (s) => s.id === id && (!s.keymap || s.keymap === keymap)
    )
    if (!spec) return ''
    const apple = isApplePlatform()
    const parts: string[] = []
    if (spec.primary) parts.push(apple ? '⌘' : 'Ctrl')
    if (spec.ctrl) parts.push(apple ? '⌃' : 'Ctrl')
    if (spec.shift === true) parts.push(apple ? '⇧' : 'Shift')
    if (spec.alt === true) parts.push(apple ? '⌥' : 'Alt')
    const key = Array.isArray(spec.key) ? spec.key[0] : spec.key
    parts.push(
        key === ' ' ? 'Space' : key.length === 1 ? key.toUpperCase() : key
    )
    return apple ? parts.join('') : parts.join('+')
}
