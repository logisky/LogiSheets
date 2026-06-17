import {describe, it, expect} from 'vitest'
import {
    getFirstCell,
    getSelectedCellRange,
    getSelectedLines,
    type SelectedData,
} from '../src/types'

describe('getSelectedCellRange', () => {
    it('returns the cell range when present', () => {
        const data: SelectedData = {
            data: {
                ty: 'cellRange',
                d: {startRow: 1, endRow: 3, startCol: 2, endCol: 4},
            },
            source: 'none',
        }
        expect(getSelectedCellRange(data)).toEqual({
            startRow: 1,
            endRow: 3,
            startCol: 2,
            endCol: 4,
        })
    })

    it('returns undefined for line selection', () => {
        const data: SelectedData = {
            data: {ty: 'line', d: {start: 0, end: 5, type: 'row'}},
            source: 'editbar',
        }
        expect(getSelectedCellRange(data)).toBeUndefined()
    })

    it('returns undefined when data is missing', () => {
        const data: SelectedData = {source: 'none'}
        expect(getSelectedCellRange(data)).toBeUndefined()
    })
})

describe('getSelectedLines', () => {
    it('returns the line selection when present', () => {
        const data: SelectedData = {
            data: {ty: 'line', d: {start: 0, end: 5, type: 'col'}},
            source: 'editbar',
        }
        expect(getSelectedLines(data)).toEqual({start: 0, end: 5, type: 'col'})
    })

    it('returns undefined for cell range selection', () => {
        const data: SelectedData = {
            data: {
                ty: 'cellRange',
                d: {startRow: 0, endRow: 1, startCol: 0, endCol: 1},
            },
            source: 'none',
        }
        expect(getSelectedLines(data)).toBeUndefined()
    })
})

describe('getFirstCell', () => {
    it('returns the top-left cell of a range', () => {
        const data: SelectedData = {
            data: {
                ty: 'cellRange',
                d: {startRow: 2, endRow: 5, startCol: 3, endCol: 6},
            },
            source: 'none',
        }
        expect(getFirstCell(data)).toEqual({y: 2, x: 3})
    })

    it('returns the start of a row selection at column 0', () => {
        const data: SelectedData = {
            data: {ty: 'line', d: {start: 4, end: 8, type: 'row'}},
            source: 'editbar',
        }
        expect(getFirstCell(data)).toEqual({y: 4, x: 0})
    })

    it('returns the start of a column selection at row 0', () => {
        const data: SelectedData = {
            data: {ty: 'line', d: {start: 7, end: 9, type: 'col'}},
            source: 'editbar',
        }
        expect(getFirstCell(data)).toEqual({y: 0, x: 7})
    })

    it('throws when selection is empty', () => {
        const data: SelectedData = {source: 'none'}
        expect(() => getFirstCell(data)).toThrow('should not happend')
    })
})
