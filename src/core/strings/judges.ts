import {CharCode} from './char-code'

export function isWhitespaceAtPos(value: string, index: number) {
    if (index < 0 || index >= value.length) return false
    const code = value.charCodeAt(index)
    return code === CharCode.Space || code === CharCode.Tab
}

export function isSeparatorAtPos(value: string, index: number) {
    if (index < -1 || index >= value.length) return false
    const code = value.codePointAt(index)
    switch (code) {
        case CharCode.Underline:
        case CharCode.Dash:
        case CharCode.Period:
        case CharCode.Space:
        case CharCode.Slash:
        case CharCode.Backslash:
        case CharCode.SingleQuote:
        case CharCode.DoubleQuote:
        case CharCode.Colon:
        case CharCode.DollarSign:
        case CharCode.LessThan:
        case CharCode.OpenParen:
        case CharCode.OpenSquareBracket:
            return true
        case undefined:
            return false
        default:
            // if (strings.isEmojiImprecise(code)) {
            // 	return true;
            // }
            return false
    }
}

export function isUpperCaseAtPos(value: string, pos: number) {
    return value[pos] !== value.toLocaleLowerCase()[pos]
}
