/**
 * See http://en.wikipedia.org/wiki/Surrogate_pair
 */
export function isHighSurrogate(charCode: number): boolean {
    return (0xD800 <= charCode && charCode <= 0xDBFF)
}

/**
 * See http://en.wikipedia.org/wiki/Surrogate_pair
 */
export function isLowSurrogate(charCode: number): boolean {
    return (0xDC00 <= charCode && charCode <= 0xDFFF)
}

/**
 * See http://en.wikipedia.org/wiki/Surrogate_pair
 */
export function computeCodePoint(
    highSurrogate: number,
    lowSurrogate: number
): number {
    return ((highSurrogate - 0xD800) << 10) + (lowSurrogate - 0xDC00) + 0x10000
}

/**
 * get the code point that begins at offset `offset`
 */
export function getNextCodePoint(
    str: string,
    len: number,
    offset: number
): number {
    const charCode = str.charCodeAt(offset)
    if (isHighSurrogate(charCode) && offset + 1 < len) {
        const nextCharCode = str.charCodeAt(offset + 1)
        if (isLowSurrogate(nextCharCode))
            return computeCodePoint(charCode, nextCharCode)
    }
    return charCode
}
