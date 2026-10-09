import {describe, expect, it} from 'vitest'
import {
    csvFieldToInput,
    csvSheetName,
    decodeCsvBytes,
    detectDelimiter,
    parseCsv,
} from './index.js'

describe('parseCsv', () => {
    it('splits plain records', () => {
        expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
            ['a', 'b', 'c'],
            ['1', '2', '3'],
        ])
    })

    it('reads quoted fields with delimiters, quotes and line breaks', () => {
        expect(parseCsv('"x, y","say ""hi""","two\r\nlines"\r\nz,,')).toEqual([
            ['x, y', 'say "hi"', 'two\r\nlines'],
            ['z', '', ''],
        ])
    })

    it('accepts CRLF, LF and bare CR, without a trailing empty record', () => {
        expect(parseCsv('a\r\nb\nc\rd\r\n')).toEqual([
            ['a'],
            ['b'],
            ['c'],
            ['d'],
        ])
    })

    it('keeps blank lines in the middle as empty records', () => {
        expect(parseCsv('a\n\nb')).toEqual([['a'], [''], ['b']])
    })

    it('strips a byte-order mark and handles an empty file', () => {
        expect(parseCsv('\ufeffa,b')).toEqual([['a', 'b']])
        expect(parseCsv('')).toEqual([])
    })

    it('keeps rows ragged', () => {
        expect(parseCsv('a,b,c\n1')).toEqual([['a', 'b', 'c'], ['1']])
    })
})

describe('detectDelimiter', () => {
    it('picks the delimiter that splits every record evenly', () => {
        expect(detectDelimiter('a;b;c\n1;2,5;3')).toBe(';')
        expect(detectDelimiter('a\tb\n1\t2')).toBe('\t')
        expect(detectDelimiter('a,b\n1,2')).toBe(',')
    })

    it('ignores delimiters inside quotes', () => {
        expect(detectDelimiter('"a;b",c\n"1;2",3')).toBe(',')
    })

    it('falls back to comma for a single column', () => {
        expect(detectDelimiter('one\ntwo')).toBe(',')
    })
})

describe('decodeCsvBytes', () => {
    const utf8 = (s: string) => new TextEncoder().encode(s)

    it('reads UTF-8 with or without a BOM', () => {
        expect(decodeCsvBytes(utf8('名称,数量'))).toBe('名称,数量')
        expect(
            decodeCsvBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('a')]))
        ).toBe('a')
    })

    it('falls back to GB18030 for what Chinese Excel writes', () => {
        // "名称" in GBK.
        const gbk = new Uint8Array([0xc3, 0xfb, 0xb3, 0xc6, 0x2c, 0x31])
        expect(decodeCsvBytes(gbk)).toBe('名称,1')
    })

    it('reads UTF-16LE with a BOM', () => {
        expect(
            decodeCsvBytes(
                new Uint8Array([0xff, 0xfe, 0x61, 0, 0x2c, 0, 0x62, 0])
            )
        ).toBe('a,b')
    })
})

describe('csvFieldToInput', () => {
    it('leaves data alone and forces would-be formulas to text', () => {
        expect(csvFieldToInput('12.5')).toBe('12.5')
        expect(csvFieldToInput('hello')).toBe('hello')
        expect(csvFieldToInput('=1+1')).toBe("'=1+1")
        expect(csvFieldToInput("'quoted")).toBe("''quoted")
    })
})

describe('csvSheetName', () => {
    it('uses the base name, cleaned and cut to 31', () => {
        expect(csvSheetName('sales.csv', [])).toBe('sales')
        expect(csvSheetName('a/b:c?.csv', [])).toBe('a_b_c_')
        expect(csvSheetName('x'.repeat(40) + '.csv', [])).toHaveLength(31)
        expect(csvSheetName('.csv', [])).toBe('Sheet')
    })

    it('numbers a name already taken, case-insensitively', () => {
        expect(csvSheetName('Sales.csv', ['sales'])).toBe('Sales (2)')
        expect(csvSheetName('s.csv', ['s', 'S (2)'])).toBe('s (3)')
        const long = 'y'.repeat(31)
        const named = csvSheetName(long + '.csv', [long])
        expect(named).toHaveLength(31)
        expect(named.endsWith(' (2)')).toBe(true)
    })
})
