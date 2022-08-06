import { Extract } from './html'

describe('html test', () => {
    [[
        '_(* #,##0_);_(* (#,##0);_(* &quot;-&quot;_);_(@_)',
        '_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)',
    ]].forEach(([data, expected]) => {
        it('extract test', () => {
            const result = Extract(data)
            expect(result).toBe(expected)
        })
    })
})