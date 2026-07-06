import {quoteSheetName, qualifyReference} from 'logisheets-engine'

describe('quoteSheetName', () => {
    const cases: [string, string][] = [
        ['Sheet2', 'Sheet2'],
        ['Data_1', 'Data_1'],
        ['My Sheet', "'My Sheet'"],
        ['2020', "'2020'"], // starts with a digit
        ['A1', "'A1'"], // looks like a cell reference
        ['R1C1', "'R1C1'"], // looks like R1C1
        ['sales-2024', "'sales-2024'"], // hyphen
        ["Bob's", "'Bob''s'"], // embedded quote doubled
    ]
    cases.forEach(([name, expected]) => {
        it(`quotes ${JSON.stringify(name)}`, () => {
            expect(quoteSheetName(name)).toBe(expected)
        })
    })
})

describe('qualifyReference', () => {
    it('prefixes a simple sheet name', () => {
        expect(qualifyReference('A1', 'Sheet2')).toBe('Sheet2!A1')
    })
    it('quotes a sheet name with spaces', () => {
        expect(qualifyReference('A1:B2', 'My Sheet')).toBe("'My Sheet'!A1:B2")
    })
})
