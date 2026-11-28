/**
 * A 0-based column index as A1 column letters: 0 -> `A`, 25 -> `Z`,
 * 26 -> `AA`. Throws for a negative or non-integer index.
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

/**
 * A number as text, the way a spreadsheet shows it: rounded to Excel's 15
 * significant decimal digits, then printed in its shortest form.
 *
 * Binary floating point leaves tails a spreadsheet never shows: `0.1+0.2` is
 * `0.30000000000000004`, `1.1*1.1` is `1.2100000000000002`. JavaScript's
 * `String(n)` prints them (it needs up to 17 digits to round-trip); Excel keeps
 * 15, so it shows `0.3` and `1.21`. This is the engine's `number_to_text`
 * (crates/controller/.../number_text.rs) on this side of the WASM boundary:
 * `toPrecision` rounds the exact binary value, as its Excel15 rule does.
 * Where scientific notation kicks in is left to `String`, as before.
 *
 * For the General format only: an explicit number format goes through
 * `formatNumber`. The stored value is unchanged.
 */
export function numberToText(n: number): string {
    // Excel15 leaves magnitudes past 1e15 alone; so do we.
    if (!Number.isFinite(n) || Math.abs(n) >= 1e15) return String(n)
    return String(Number(n.toPrecision(15)))
}
