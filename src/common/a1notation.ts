// https://github.com/FLighter7/a1-notation
import { upperCase } from './strings'
import {isString} from './type-guard'
const a1notationReg = /^(?<cs>[A-Z]+)(?<rs>\d+)(:(?<ce>[A-Z]+)(?<re>\d+))?$/i
const notationReq = /^[A-Z]/
export function isA1notation(value: unknown) {
    if (!isString(value))
        return false
    return a1notationReg.test(upperCase(value))
}
// 所有的返回值都是从0开始
export function parseA1notation(value: string): {cs: number, rs: number, ce?: number, re?: number} | undefined {
    const result = upperCase(value).match(a1notationReg)
    if (!result?.groups)
        return
    let {ce, re, cs, rs} = result.groups
    return {
        cs: toZeroBasedNotation(cs),
        rs: parseInt(rs) - 1,
        ce: ce ? toZeroBasedNotation(ce) : undefined,
        re: re ? parseInt(re) - 1 : undefined,
    }
}
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
    const n = upperCase(notation)
    if (!n.match(notationReq) || n === '')
        throw Error(
            `Invalid notation ${n}. Must be a [A-Z] character.`)
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
    for (let pos = 0; pos < n.length ; pos += 1) {
        const powNumber = n.length - 1 - pos
        index += (Math.pow(26, powNumber) * (n.charCodeAt(pos) - 64))
    }

    return index - 1
}
