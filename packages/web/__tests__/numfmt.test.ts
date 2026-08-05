import {describe, it, expect} from 'vitest'
import {formatNumber, formatText} from '../index'

// End-to-end coverage for native number-format rendering: these call
// `format_number` / `format_text` in the engine WASM (the Rust `ssf-rs` port),
// which is what replaced the old `ssf` npm dependency. The wasm module is
// initialized by __tests__/setup.ts. Expected values match Excel / the
// reference `ssf`.
describe('numfmt (native ssf-rs via WASM)', () => {
    const cases: Array<[string, number, string]> = [
        ['0', 42.7, '43'],
        ['0.00', 3.14159, '3.14'],
        ['0.00%', 0.1234, '12.34%'],
        ['0%', 0.5, '50%'],
        ['#,##0.00', 1234.5, '1,234.50'],
        ['#,##0', -1234567, '-1,234,567'],
        ['#,##0;(#,##0)', -1234567, '(1,234,567)'],
        ['$#,##0.00', 1234.5, '$1,234.50'],
        ['0.00E+00', 12345.678, '1.23E+04'],
        ['# ??/??', 1.625, '1  5/8 '],
        // date / time serials (1900 system)
        ['yyyy-mm-dd', 45000, '2023-03-15'],
        ['d-mmm-yy', 45000, '15-Mar-23'],
        ['mmm-yy', 45000, 'Mar-23'],
        ['h:mm:ss', 0.5, '12:00:00'],
        ['h:mm AM/PM', 0.75, '6:00 PM'],
        ['[h]:mm:ss', 1.5, '36:00:00'],
        ['000-00-0000', 123456789, '123-45-6789'],
        ['(###) ###-####', 8005551234, '(800) 555-1234'],
    ]

    it.each(cases)('formatNumber(%j, %d) === %j', (fmt, val, want) => {
        expect(formatNumber(fmt, val)).toBe(want)
    })

    it('renders General natively', () => {
        expect(formatNumber('General', 0.1)).toBe('0.1')
        expect(formatNumber('General', 1000000000)).toBe('1000000000')
    })

    it('falls back to String(value) on an unsupported format, never throws', () => {
        // An unterminated string in the format code makes ssf-rs return Err; the
        // wasm wrapper falls back to String(value) rather than throwing.
        expect(formatNumber('"unterminated', 3.14)).toBe('3.14')
    })

    it('formats text with the @ section', () => {
        expect(formatText('@', 'hello')).toBe('hello')
        expect(formatText('"x"@"y"', 'z')).toBe('xzy')
    })
})
