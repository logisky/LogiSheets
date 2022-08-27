/**
 * https://www.w3.org/TR/uievents-code/.
 * https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code.
 * `KeyboardEvent.code` property represents a physical key on the keyboard.
 */
export const enum KeyboardEventCode {
    /**
     * `~ on a US keyboard. This is the 半角/全角/漢字 (hankaku/zenkaku/kanji)
     * key on Japanese keyboard.
     */
    BACKQUOTE = 'Backquote',
    /**
     * 'Used for both the US \| (on the 101-key layout) and also for the key
     * located between the and Enter keys on row C of the 102-, 104- and
     * 106-key layouts. Labelled #~ on a UK (102) keyboard'.
     */
    BACKSLASH = 'Backslash',
    /**
     *  Backspace or ⌫. Labelled Delete on Apple keyboards.
     */
    BACKSPACE = 'Backspace',
    /**
     * [{ on a US keyboard.
     */
    BRACKET_LEFT = 'BracketLeft',
    /**
     * ]} on a US keyboard.
     */
    BRACKET_RIGHT = 'BracketRight',
    /**
     * ,< on a US keyboard.
     */
    COMMA = 'Comma',
    /**
     * 0) on a US keyboard.
     */
    DIGIT_0 = 'Digit0',
    /**
     * 1! on a US keyboard.
     */
    DIGIT_1 = 'Digit1',
    /**
     * 2@ on a US keyboard.
     */
    DIGIT_2 = 'Digit2',
    /**
     * 3# on a US keyboard.
     */
    DIGIT_3 = 'Digit3',
    /**
     * 4$ on a US keyboard.
     */
    DIGIT_4 = 'Digit4',
    /**
     * 5% on a US keyboard.
     */
    DIGIT_5 = 'Digit5',
    /**
     * 6^ on a US keyboard.
     */
    DIGIT_6 = 'Digit6',
    /**
     * 7& on a US keyboard.
     */
    DIGIT_7 = 'Digit7',
    /**
     * 8* on a US keyboard.
     */
    DIGIT_8 = 'Digit8',
    /**
     * 9( on a US keyboard.
     */
    DIGIT_9 = 'Digit9',
    /**
     * =+ on a US keyboard.
     */
    EQUAL = 'Equal',
    /**
     * Located between the left Shift and Z keys. Labelled \| on a UK keyboard.
     */
    INTL_BACKSLASH = 'IntlBackslash',
    /**
     * Located between the / and right Shift keys. Labelled \ろ (ro) on a
     * Japanese keyboard.
     */
    INTL_RO = 'IntlRo',
    /**
     * Located between the = and Backspace keys. Labelled ¥ (yen) on a Japanese
     * keyboard. \/ on a Russian keyboard.
     */
    INTL_YEN = 'IntlYen',
    /**
     * a on a US keyboard. Labelled q on an AZERTY (e.g., French) keyboard.
     */
    KEY_A = 'KeyA',
    /**
     * b on a US keyboard.
     */
    KEY_B = 'KeyB',
    /**
     * c on a US keyboard.
     */
    KEY_C = 'KeyC',
    /**
     * d on a US keyboard.
     */
    KEY_D = 'KeyD',
    /**
     * e on a US keyboard.
     */
    KEY_E = 'KeyE',
    /**
     * f on a US keyboard.
     */
    KEY_F = 'KeyF',
    /**
     * g on a US keyboard.
     */
    KEY_G = 'KeyG',
    /**
     * h on a US keyboard.
     */
    KEY_H = 'KeyH',
    /**
     * i on a US keyboard.
     */
    KEY_I = 'KeyI',
    /**
     * j on a US keyboard.
     */
    KEY_J = 'KeyJ',
    /**
     * k on a US keyboard.
     */
    KEY_K = 'KeyK',
    /**
     * l on a US keyboard.
     */
    KEY_L = 'KeyL',
    /**
     * m on a US keyboard.
     */
    KEY_M = 'KeyM',
    /**
     * n on a US keyboard.
     */
    KEY_N = 'KeyN',
    /**
     * o on a US keyboard.
     */
    KEY_O = 'KeyO',
    /**
     * p on a US keyboard.
     */
    KEY_P = 'KeyP',
    /**
     * q on a US keyboard. Labelled a on an AZERTY (e.g., French) keyboard.
     */
    KEY_Q = 'KeyQ',
    /**
     * r on a US keyboard.
     */
    KEY_R = 'KeyR',
    /**
     * s on a US keyboard.
     */
    KEY_S = 'KeyS',
    /**
     * t on a US keyboard.
     */
    KEY_T = 'KeyT',
    /**
     * u on a US keyboard.
     */
    KEY_U = 'KeyU',
    /**
     * v on a US keyboard.
     */
    KEY_V = 'KeyV',
    /**
     * w on a US keyboard. Labelled z on an AZERTY (e.g., French) keyboard.
     */
    KEY_W = 'KeyW',
    /**
     * x on a US keyboard.
     */
    KEY_X = 'KeyX',
    /**
     * y on a US keyboard. Labelled z on a QWERTZ (e.g., German) keyboard.
     */
    KEY_Y = 'KeyY',
    /**
     * z on a US keyboard. Labelled w on an AZERTY (e.g., French) keyboard, and
     * y on a QWERTZ (e.g., German) keyboard.
     */
    KEY_Z = 'KeyZ',
    /**
     * -_ on a US keyboard.
     */
    MINUS = 'Minus',
    /**
     * .> on a US keyboard.
     */
    PERIOD = 'Period',
    /**
     * on a US keyboard.
     */
    QUOTE = 'Quote',
    /**
     * ;: on a US keyboard.
     */
    SEMICOLON = 'Semicolon',
    /**
     * /? on a US keyboard.
     */
    SLASH = 'Slash',
    /**
     * Alt, Option or ⌥.
     */
    ALT_LEFT = 'AltLeft',
    /**
     * Alt, Option or ⌥. This is labelled AltGr key on many keyboard layouts.
     */
    ALT_RIGHT = 'AltRight',
    /**
     * CapsLock or ⇪.
     */
    CAPS_LOCK = 'CapsLock',
    /**
     * The application context menu key, which is typically found between the
     * right Meta key and the right Control key.
     */
    CONTENT_MENU = 'ContextMenu',
    /**
     * Control or ⌃.
     */
    CONTROL_LEFT = 'ControlLeft',
    /**
     * Control or ⌃.
     */
    CONTROL_RIGHT = 'ControlRight',
    /**
     * Enter or ↵. Labelled Return on Apple keyboards.
     */
    ENTER = 'Enter',
    /**
     * The Windows, ⌘, Command or other OS symbol key.
     */
    METALEFT = 'MetaLeft',
    /**
     * The Windows, ⌘, Command or other OS symbol key.
     */
    META_RIGHT = 'MetaRight',
    /**
     * Shift or ⇧.
     */
    SHIFT_LEFT = 'ShiftLeft',
    /**
     * Shift or ⇧.
     */
    SHIFT_RIGHT = 'ShiftRight',
    /**
     *   (space).
     */
    SPACE = 'Space',
    /**
     * Tab or ⇥.
     */
    TAB = 'Tab',
    /**
     * ⌦. The forward delete key. Note that on Apple keyboards, the key
     * labelled Delete on the main part of the keyboard should be encoded as
     * Backspace .
     */
    DELETE = 'Delete',
    /**
     * Page Down, End or ↘.
     */
    END = 'End',
    /**
     * Help. Not present on standard PC keyboards.
     */
    HELP = 'Help',
    /**
     * Home or ↖.
     */
    HOME = 'Home',
    /**
     * Insert or Ins. Not present on Apple keyboards.
     */
    INSERT = 'Insert',
    /**
     * Page Down, PgDn or ⇟.
     */
    PAGE_DOWN = 'PageDown',
    /**
     * Page Up, PgUp or ⇞.
     */
    PAGE_UP = 'PageUp',
    /**
     * ↓.
     */
    ARROW_DOWN = 'ArrowDown',
    /**
     * ←.
     */
    ARROW_LEFT = 'ArrowLeft',
    /**
     * →.
     */
    ARROW_RIGHT = 'ArrowRight',
    /**
     * ↑.
     */
    ARROW_UP = 'ArrowUp',
    /**
     * On the Mac, the  NumLock  code should be used for the numpad Clear key.
     */
    NUM_LOCK = 'NumLock',
    /**
     * 0 Ins on a keyboard.
     */
    NUMPAD_0 = 'Numpad0',
    /**
     * 1 End on a keyboard.
     */
    NUMPAD_1 = 'Numpad1',
    /**
     * 2 ↓ on a keyboard.
     */
    NUMPAD_2 = 'Numpad2',
    /**
     * 3 PgDn on a keyboard.
     */
    NUMPAD_3 = 'Numpad3',
    /**
     * 4 ← on a keyboard.
     */
    NUMPAD_4 = 'Numpad4',
    /**
     * 5 on a keyboard.
     */
    NUMPAD_5 = 'Numpad5',
    /**
     * 6 → on a keyboard.
     */
    NUMPAD_6 = 'Numpad6',
    /**
     * 7 Home on a keyboard.
     */
    NUMPAD_7 = 'Numpad7',
    /**
     * 8 ↑ on a keyboard.
     */
    NUMPAD_8 = 'Numpad8',
    /**
     * 9 PgUp on a keyboard.
     */
    NUMPAD_9 = 'Numpad9',
    /**
     * `+`.
     */
    NUMPAD_ADD = 'NumpadAdd',
    /**
     * Found on the Microsoft Natural Keyboard.
     */
    NUMPAD_BACKSPACE = 'NumpadBackspace',
    /**
     * C or AC (All Clear). Also for use with numpads that have a Clear key
     * that is separate from the NumLock key. On the Mac, the numpad Clear key
     * should always be encoded as NumLock .
     */
    NUMPAD_CLEAR = 'NumpadClear',
    /**
     * CE (Clear Entry).
     */
    NUMPAD_CLEAR_ENTRY = 'NumpadClearEntry',
    /**
     * `,` (thousands separator). For locales where the thousands separator is a
     * `.` (e.g., Brazil), this key may generate a `.`.
     */
    NUMPAD_COMMA = 'NumpadComma',
    /**
     * `.` Del. For locales where the decimal separator is , (e.g., Brazil),
     * this key may generate a `,.`.
     */
    NUMPAD_DECIMAL = 'NumpadDecimal',
    /**
     * `/`.
     */
    NUMPAD_DIVIDE = 'NumpadDivide',
    NUMPAD_ENTER = 'NumpadEnter',
    /**
     * `=`.
     */
    NUMPAD_EQUAL = 'NumpadEqual',
    /**
     * # on a phone or remote control device. This key is typically found below
     * the 9 key and to the right of the 0 key.
     */
    NUMPAD_HASH = 'NumpadHash',
    /**
     * M+ Add current entry to the value stored in memory.
     */
    NUMPAD_MEMORY_ADD = 'NumpadMemoryAdd',
    /**
     * MC Clear the value stored in memory.
     */
    NUMPAD_MEMORY_CLEAR = 'NumpadMemoryClear',
    /**
     * MR Replace the current entry with the value stored in memory.
     */
    NUMPAD_MEMEORY_RECALL = 'NumpadMemoryRecall',
    /**
     * MS Replace the value stored in memory with the current entry.
     */
    NUMPAD_MEMORY_STORE = 'NumpadMemoryStore',
    /**
     * M- Subtract current entry from the value stored in memory.
     */
    NUMPAD_MEMORY_SUBTRACT = 'NumpadMemorySubtract',
    /**
     * `*` on a keyboard. For use with numpads that provide mathematical
     * operations (+, -, * and /).
     */
    NUMPAD_MULTIPLY = 'NumpadMultiply',
    /**
     * NumpadStar  for the * key on phones and remote controls.
     */
    USE = 'Use',
    /**
     * ( Found on the Microsoft Natural Keyboard.
     */
    NUMPAD_PARENT_LEFT = 'NumpadParenLeft',
    /**
     * ) Found on the Microsoft Natural Keyboard.
     */
    NUMPAD_PARENT_RIGHT = 'NumpadParenRight',
    /**
     * `*` on a phone or remote control device. This key is typically found
     * below the 7 key and to the left of the 0 key.
     */
    NUMPAD_STAR = 'NumpadStar',
    /**
     * `-`.
     */
    NUMPAD_SUBTRACT = 'NumpadSubtract',
    /**
     *  Esc or ⎋.
     */
    ESCAPE = 'Escape',
    F1 = 'F1',
    F2 = 'F2',
    F3 = 'F3',
    F4 = 'F4',
    F5 = 'F5',
    F6 = 'F6',
    F7 = 'F7',
    F8 = 'F8',
    F9 = 'F9',
    F10 = 'F10',
    F11 = 'F11',
    F12 = 'F12',
    F13 = 'F13',
    F14 = 'F14',
    F15 = 'F15',
    /**
     * Fn This is typically a hardware key that does not generate a separate
     * code. Most keyboards do not place this key in the function section, but
     * it is included here to keep it with related keys.
     */
    FN = 'Fn',
    /**
     * FLock or FnLock. Function Lock key. Found on the Microsoft Natural
     * Keyboard.
     */
    FN_LOCK = 'FnLock',
    /**
     * PrtScr SysRq or Print Screen.
     */
    PRINT_SCREEN = 'PrintScreen',
    /**
     * Scroll Lock.
     */
    SCROLL_LOCK = 'ScrollLock',
    /**
     * Pause Break.
     */
    PAUSE = 'Pause',

    UNKNOWN = 'Unknown',
}
export function extractKeyCode(e: KeyboardEvent) {
    const allCodes = [
        KeyboardEventCode.BACKQUOTE,
        KeyboardEventCode.BACKSLASH,
        KeyboardEventCode.BACKSPACE,
        KeyboardEventCode.BRACKET_LEFT,
        KeyboardEventCode.BRACKET_RIGHT,
        KeyboardEventCode.COMMA,
        KeyboardEventCode.DIGIT_0,
        KeyboardEventCode.DIGIT_1,
        KeyboardEventCode.DIGIT_2,
        KeyboardEventCode.DIGIT_3,
        KeyboardEventCode.DIGIT_4,
        KeyboardEventCode.DIGIT_5,
        KeyboardEventCode.DIGIT_6,
        KeyboardEventCode.DIGIT_7,
        KeyboardEventCode.DIGIT_8,
        KeyboardEventCode.DIGIT_9,
        KeyboardEventCode.EQUAL,
        KeyboardEventCode.INTL_BACKSLASH,
        KeyboardEventCode.INTL_RO,
        KeyboardEventCode.INTL_YEN,
        KeyboardEventCode.KEY_A,
        KeyboardEventCode.KEY_B,
        KeyboardEventCode.KEY_C,
        KeyboardEventCode.KEY_D,
        KeyboardEventCode.KEY_E,
        KeyboardEventCode.KEY_F,
        KeyboardEventCode.KEY_G,
        KeyboardEventCode.KEY_H,
        KeyboardEventCode.KEY_I,
        KeyboardEventCode.KEY_J,
        KeyboardEventCode.KEY_K,
        KeyboardEventCode.KEY_L,
        KeyboardEventCode.KEY_M,
        KeyboardEventCode.KEY_N,
        KeyboardEventCode.KEY_O,
        KeyboardEventCode.KEY_P,
        KeyboardEventCode.KEY_Q,
        KeyboardEventCode.KEY_R,
        KeyboardEventCode.KEY_S,
        KeyboardEventCode.KEY_T,
        KeyboardEventCode.KEY_U,
        KeyboardEventCode.KEY_V,
        KeyboardEventCode.KEY_W,
        KeyboardEventCode.KEY_X,
        KeyboardEventCode.KEY_Y,
        KeyboardEventCode.KEY_Z,
        KeyboardEventCode.MINUS,
        KeyboardEventCode.PERIOD,
        KeyboardEventCode.QUOTE,
        KeyboardEventCode.SEMICOLON,
        KeyboardEventCode.SLASH,
        KeyboardEventCode.ALT_LEFT,
        KeyboardEventCode.ALT_RIGHT,
        KeyboardEventCode.CAPS_LOCK,
        KeyboardEventCode.CONTENT_MENU,
        KeyboardEventCode.CONTROL_LEFT,
        KeyboardEventCode.CONTROL_RIGHT,
        KeyboardEventCode.ENTER,
        KeyboardEventCode.METALEFT,
        KeyboardEventCode.META_RIGHT,
        KeyboardEventCode.SHIFT_LEFT,
        KeyboardEventCode.SHIFT_RIGHT,
        KeyboardEventCode.SPACE,
        KeyboardEventCode.TAB,
        KeyboardEventCode.DELETE,
        KeyboardEventCode.END,
        KeyboardEventCode.HELP,
        KeyboardEventCode.HOME,
        KeyboardEventCode.INSERT,
        KeyboardEventCode.PAGE_DOWN,
        KeyboardEventCode.PAGE_UP,
        KeyboardEventCode.ARROW_DOWN,
        KeyboardEventCode.ARROW_LEFT,
        KeyboardEventCode.ARROW_RIGHT,
        KeyboardEventCode.ARROW_UP,
        KeyboardEventCode.NUM_LOCK,
        KeyboardEventCode.NUMPAD_0,
        KeyboardEventCode.NUMPAD_1,
        KeyboardEventCode.NUMPAD_2,
        KeyboardEventCode.NUMPAD_3,
        KeyboardEventCode.NUMPAD_4,
        KeyboardEventCode.NUMPAD_5,
        KeyboardEventCode.NUMPAD_6,
        KeyboardEventCode.NUMPAD_7,
        KeyboardEventCode.NUMPAD_8,
        KeyboardEventCode.NUMPAD_9,
        KeyboardEventCode.NUMPAD_ADD,
        KeyboardEventCode.NUMPAD_BACKSPACE,
        KeyboardEventCode.NUMPAD_CLEAR,
        KeyboardEventCode.NUMPAD_CLEAR_ENTRY,
        KeyboardEventCode.NUMPAD_COMMA,
        KeyboardEventCode.NUMPAD_DECIMAL,
        KeyboardEventCode.NUMPAD_DIVIDE,
        KeyboardEventCode.NUMPAD_ENTER,
        KeyboardEventCode.NUMPAD_EQUAL,
        KeyboardEventCode.NUMPAD_HASH,
        KeyboardEventCode.NUMPAD_MEMORY_ADD,
        KeyboardEventCode.NUMPAD_MEMORY_CLEAR,
        KeyboardEventCode.NUMPAD_MEMEORY_RECALL,
        KeyboardEventCode.NUMPAD_MEMORY_STORE,
        KeyboardEventCode.NUMPAD_MEMORY_SUBTRACT,
        KeyboardEventCode.NUMPAD_MULTIPLY,
        KeyboardEventCode.USE,
        KeyboardEventCode.NUMPAD_PARENT_LEFT,
        KeyboardEventCode.NUMPAD_PARENT_RIGHT,
        KeyboardEventCode.NUMPAD_STAR,
        KeyboardEventCode.NUMPAD_SUBTRACT,
        KeyboardEventCode.ESCAPE,
        KeyboardEventCode.F1,
        KeyboardEventCode.F2,
        KeyboardEventCode.F3,
        KeyboardEventCode.F4,
        KeyboardEventCode.F5,
        KeyboardEventCode.F6,
        KeyboardEventCode.F7,
        KeyboardEventCode.F8,
        KeyboardEventCode.F9,
        KeyboardEventCode.F10,
        KeyboardEventCode.F11,
        KeyboardEventCode.F12,
        KeyboardEventCode.F13,
        KeyboardEventCode.F14,
        KeyboardEventCode.F15,
        KeyboardEventCode.FN,
        KeyboardEventCode.FN_LOCK,
        KeyboardEventCode.PRINT_SCREEN,
        KeyboardEventCode.SCROLL_LOCK,
        KeyboardEventCode.PAUSE,
        KeyboardEventCode.UNKNOWN,
    ]
    return allCodes.find((c) => c === e.code) ?? KeyboardEventCode.UNKNOWN
}

export function isNumPad(code: KeyboardEventCode) {
    const numpadCodes: readonly string[] = [
        KeyboardEventCode.NUMPAD_0,
        KeyboardEventCode.NUMPAD_1,
        KeyboardEventCode.NUMPAD_2,
        KeyboardEventCode.NUMPAD_3,
        KeyboardEventCode.NUMPAD_4,
        KeyboardEventCode.NUMPAD_5,
        KeyboardEventCode.NUMPAD_6,
        KeyboardEventCode.NUMPAD_7,
        KeyboardEventCode.NUMPAD_8,
        KeyboardEventCode.NUMPAD_9,
        KeyboardEventCode.NUMPAD_ADD,
        KeyboardEventCode.NUMPAD_CLEAR,
        KeyboardEventCode.NUMPAD_CLEAR_ENTRY,
        KeyboardEventCode.NUMPAD_COMMA,
        KeyboardEventCode.NUMPAD_EQUAL,
        KeyboardEventCode.NUMPAD_DECIMAL,
        KeyboardEventCode.NUMPAD_DIVIDE,
        KeyboardEventCode.NUMPAD_ENTER,
        KeyboardEventCode.NUMPAD_MULTIPLY,
        KeyboardEventCode.NUMPAD_SUBTRACT,
    ]
    return numpadCodes.includes(code)
}
