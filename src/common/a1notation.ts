/**
 * Convert a 0-based column index to A1-notation, i.e., A, BC, etc..
 *
 * Note that the in Excel A1-notation, row indices are plain integers and don't
 * need to be formatted to A1-notation.
 */
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
            `Invalid column index '${index}'. Must be a non-negative integer.`)

    // Use 0-based index internally.
    let n = index
    let ret = ''
    while (n > -1) {
        // 26 = number of letters from A to Z
        // 0x41 = 65 = the code point of 'A'
        const codePoint = n % 26 + 0x41
        ret = String.fromCodePoint(codePoint) + ret
        n = Math.floor(n / 26) - 1
    }

    return ret
}

/**
 * Convert a A1-notation to 0-based column index, i.e., A, BC, etc..
 */
export function toZeroBasedNotation(notation: string): number {
    if (notation.match(/[^A-Z]/) || notation === '')
        throw Error(
            `Invalid position'${notation}'. Must be a [A-Z] character.`)
    let index = 0
    // Calculation method:
    // Example:
    //
    //   position:                           "ABC"
    //   char                           "A"       "B"       "C"
    //   charCode                        65        66       67
    //   number                          1         2        3
    //   powNumber                       2         1        0
    //   sum=number*26^powNumber       1*26^2    2*26^1   3*26^0
    //   numberSum(one_based_index) =  1*26^2 + 2*26^1 + 3*26^0  = 731
    //   index(zero_based_index) = numSum - 1 = 730
    for (let pos = 0; pos < notation.length ; pos += 1) {
        const powNumber = notation.length - 1 - pos
        index += (Math.pow(26, powNumber) * (notation.charCodeAt(pos) - 64))
    }

    return index - 1
}
