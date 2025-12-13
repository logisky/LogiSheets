export function toA1notation(index: number): string {
    /**
     * The algorithm employed here is the same as converting numbers between
     * different bases, e.g., decimal vs. hexadecimal.
     *
     * The A1-notation uses A-Z as the basic letters.  Therefore it is
     * intrinsically a 26-based notation.
     */
    if (!Number.isSafeInteger(index) || index < 0)
        throw Error(
            `Invalid column index '${index}'. Must be a non-negative integer.`
        )

    // Use 0-based index internally.
    let n = index
    let ret = ''
    while (n > -1) {
        // 26 = number of letters from A to Z
        // 0x41 = 65 = the code point of 'A'
        const codePoint = (n % 26) + 0x41
        ret = String.fromCodePoint(codePoint) + ret
        n = Math.floor(n / 26) - 1
    }

    return ret
}
