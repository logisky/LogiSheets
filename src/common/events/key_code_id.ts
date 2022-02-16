/**
 * Virtual Key Codes, the value does not hold any inherent meaning.
 * Inspired somewhat from https://msdn.microsoft.com/en-us/library/windows/desktop/dd375731(v=vs.85).aspx
 * But these are "more general", as they should work across browsers & OS`s.
 */
 export const enum KeyCodeId {
    /**
     * Placed first to cover the 0 value of the enum.
     */
    UNKNOWN = 0,
    BACKSPACE = 1,
    TAB = 2,
    ENTER = 3,
    LEFTSHIFT = 4,
    LEFTCTRL = 5,
    LEFTALT = 6,
    /**
     * "Pause" key with Control causes keycode of cancel(3).
     */
    PAUSEBREAK = 7,
    CAPSLOCK = 8,
    ESCAPE = 9,
    SPACE = 10,
    PAGEUP = 11,
    PAGEDOWN = 12,
    END = 13,
    HOME = 14,
    LEFTARROW = 15,
    UPARROW = 16,
    RIGHTARROW = 17,
    DOWNARROW = 18,
    INSERT = 19,
    DELETE = 20,

    KEY_0 = 21,
    KEY_1 = 22,
    KEY_2 = 23,
    KEY_3 = 24,
    KEY_4 = 25,
    KEY_5 = 26,
    KEY_6 = 27,
    KEY_7 = 28,
    KEY_8 = 29,
    KEY_9 = 30,

    KEY_A = 31,
    KEY_B = 32,
    KEY_C = 33,
    KEY_D = 34,
    KEY_E = 35,
    KEY_F = 36,
    KEY_G = 37,
    KEY_H = 38,
    KEY_I = 39,
    KEY_J = 40,
    KEY_K = 41,
    KEY_L = 42,
    KEY_M = 43,
    KEY_N = 44,
    KEY_O = 45,
    KEY_P = 46,
    KEY_Q = 47,
    KEY_R = 48,
    KEY_S = 49,
    KEY_T = 50,
    KEY_U = 51,
    KEY_V = 52,
    KEY_W = 53,
    KEY_X = 54,
    KEY_Y = 55,
    KEY_Z = 56,
    LEFTMETA = 57,
    CONTEXTMENU = 58,

    F1 = 59,
    F2 = 60,
    F3 = 61,
    F4 = 62,
    F5 = 63,
    F6 = 64,
    F7 = 65,
    F8 = 66,
    F9 = 67,
    F10 = 68,
    F11 = 69,
    F12 = 70,
    F13 = 71,
    F14 = 72,
    F15 = 73,
    F16 = 74,
    F17 = 75,
    F18 = 76,
    F19 = 77,

    NUMLOCK = 78,
    SCROLLLOCK = 79,

    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the ';:' key
     */
    US_SEMICOLON = 80,
    /**
     * For any country/region, the '+' key
     * For the US standard keyboard, the '=+' key
     */
    US_EQUAL = 81,
    /**
     * For any country/region, the ',' key
     * For the US standard keyboard, the ',<' key
     */
    US_COMMA = 82,
    /**
     * For any country/region, the '-' key
     * For the US standard keyboard, the '-_' key
     */
    US_MINUS = 83,
    /**
     * For any country/region, the '.' key
     * For the US standard keyboard, the '.>' key
     */
    US_DOT = 84,
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the '/?' key
     */
    US_SLASH = 85,
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the '`~' key
     */
    US_BACKTICK = 86,
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the '[{' key
     */
    US_OPEN_SQUARE_BRACKET = 87,
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the '\|' key
     */
    US_BACKSLASH = 88,
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the ']}' key
     */
    US_CLOSE_SQUARE_BRACKET = 89,
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     * For the US standard keyboard, the ''"' key
     */
    US_QUOTE = 90,
    /**
     * Used for miscellaneous characters; it can vary by keyboard.
     */
    OEM_8 = 91,
    /**
     * Either the angle bracket key or the backslash key
     * on the RT 102-key keyboard.
     */
    OEM_102 = 92,

    NUMPAD_0 = 93, // VK_NUMPAD0, 0x60, Numeric keypad 0 key
    NUMPAD_1 = 94, // VK_NUMPAD1, 0x61, Numeric keypad 1 key
    NUMPAD_2 = 95, // VK_NUMPAD2, 0x62, Numeric keypad 2 key
    NUMPAD_3 = 96, // VK_NUMPAD3, 0x63, Numeric keypad 3 key
    NUMPAD_4 = 97, // VK_NUMPAD4, 0x64, Numeric keypad 4 key
    NUMPAD_5 = 98, // VK_NUMPAD5, 0x65, Numeric keypad 5 key
    NUMPAD_6 = 99, // VK_NUMPAD6, 0x66, Numeric keypad 6 key
    NUMPAD_7 = 100, // VK_NUMPAD7, 0x67, Numeric keypad 7 key
    NUMPAD_8 = 101, // VK_NUMPAD8, 0x68, Numeric keypad 8 key
    NUMPAD_9 = 102, // VK_NUMPAD9, 0x69, Numeric keypad 9 key

    NUMPAD_MULTIPLY = 103,    // VK_MULTIPLY, 0x6A, Multiply key
    NUMPAD_ADD = 104,        // VK_ADD, 0x6B, Add key
    NUMPAD_SEPARATOR = 105,    // VK_SEPARATOR, 0x6C, Separator key
    NUMPAD_SUBTRACT = 106,    // VK_SUBTRACT, 0x6D, Subtract key
    NUMPAD_DECIMAL = 107,    // VK_DECIMAL, 0x6E, Decimal key
    NUMPAD_DIVIDE = 108,    // VK_DIVIDE, 0x6F,

    /**
     * Cover all key codes when IME is processing input.
     */
    KEY_IN_COMPOSITION = 109,

    ABNT_C1 = 110, // Brazilian (ABNT) Keyboard
    ABNT_C2 = 111, // Brazilian (ABNT) Keyboard
    RIGHTSHIFT = 112,
    RIGHTCTRL = 113,
    RIGHTALT = 114,
    RIGHTMETA = 114,
    NUMPAD_EQUAL = 115,

    /**
     * Placed last to cover the length of the enum.
     * Please do not depend on this value!
     */
    MAX_VALUE,
}
