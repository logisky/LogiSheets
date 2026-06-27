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
    | 'formatCells'
    | 'insertDate'
    | 'insertTime'
    | 'autoSum'
    | 'toggleFormulas'

/** `true`/`false` require the modifier up/down; `'any'` ignores it. */
type ModReq = boolean | 'any'

interface ShortcutSpec {
    id: ShortcutId
    /** Human-readable label, e.g. shown in menus / tooltips. */
    description: string
    /** `KeyboardEvent.key` value(s) to match, compared case-insensitively. */
    key: string | readonly string[]
    /** Requires the primary modifier (⌘ / Ctrl). Default false. */
    primary?: boolean
    /** Shift requirement. Default false (Shift must be up); `'any'` ignores. */
    shift?: ModReq
    /** Alt / Option requirement. Default false; `'any'` ignores. */
    alt?: ModReq
}

// Every key binding, in one table. `key` uses KeyboardEvent.key values.
// Display strings (Ctrl vs ⌘) are derived per-platform by `shortcutLabel`.
export const SHORTCUTS: readonly ShortcutSpec[] = [
    // ---- Navigation / editing (bare keys) ----
    // Arrows move the selection; Shift is ignored (range-extend not yet built).
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
    // Ctrl/⌘+Arrow: jump to the next data/block boundary. Shift ignored.
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
    {id: 'formatCells', description: 'Format cells', key: '1', primary: true},
    {id: 'insertDate', description: 'Insert date', key: ';', primary: true},
    {
        id: 'insertTime',
        description: 'Insert time',
        key: ';',
        primary: true,
        shift: true,
    },
    {id: 'autoSum', description: 'AutoSum', key: '=', primary: true, alt: true},
    {
        id: 'toggleFormulas',
        description: 'Show formulas',
        key: '`',
        primary: true,
    },
]

function modOk(pressed: boolean, req: ModReq | undefined): boolean {
    return req === 'any' ? true : pressed === !!req
}

function matches(e: KeyboardEvent, spec: ShortcutSpec): boolean {
    const keys = Array.isArray(spec.key) ? spec.key : [spec.key]
    if (!keys.some((k) => k.toLowerCase() === e.key.toLowerCase())) return false
    if (primaryPressed(e) !== !!spec.primary) return false
    if (!modOk(e.shiftKey, spec.shift)) return false
    if (!modOk(e.altKey, spec.alt)) return false
    return true
}

/** The shortcut a key event maps to, or null. */
export function matchShortcut(e: KeyboardEvent): ShortcutId | null {
    return SHORTCUTS.find((s) => matches(e, s))?.id ?? null
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
    handlers: ShortcutHandlers
): boolean {
    const id = matchShortcut(e)
    if (!id) return false
    const handler = handlers[id]
    if (!handler) return false
    handler(e)
    return true
}

/** Platform-aware display label, e.g. "⌘C" on Mac, "Ctrl+C" on Windows. */
export function shortcutLabel(id: ShortcutId): string {
    const spec = SHORTCUTS.find((s) => s.id === id)
    if (!spec) return ''
    const apple = isApplePlatform()
    const parts: string[] = []
    if (spec.primary) parts.push(apple ? '⌘' : 'Ctrl')
    if (spec.shift === true) parts.push(apple ? '⇧' : 'Shift')
    if (spec.alt === true) parts.push(apple ? '⌥' : 'Alt')
    const key = Array.isArray(spec.key) ? spec.key[0] : spec.key
    parts.push(key.length === 1 ? key.toUpperCase() : key)
    return apple ? parts.join('') : parts.join('+')
}
