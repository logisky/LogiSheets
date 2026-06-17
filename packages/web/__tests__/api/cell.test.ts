import {describe, it, expect} from 'vitest'
import {Cell, CellValue} from '../../src/api/cell'
import type {CellInfo, Style, Value} from '../../src/bindings'

const emptyStyle: Style = {
    font: {
        bold: false,
        italic: false,
        strike: false,
        outline: false,
        shadow: false,
        condense: false,
        extend: false,
    },
    fill: {type: 'patternFill', value: {}},
    border: {outline: false},
    alignment: undefined,
    protection: undefined,
    formatter: '',
}

function makeCellInfo(
    value: Value,
    formula = '',
    style = emptyStyle
): CellInfo {
    return {value, formula, style, blockId: 7}
}

describe('CellValue', () => {
    it('represents an empty value', () => {
        const v = CellValue.from('empty')
        expect(v.value).toBe('')
        expect(v.valueStr).toBe('')
        expect(v.cellValueOneof).toBeUndefined()
    })

    it('represents a string value', () => {
        const v = CellValue.from({type: 'str', value: 'hello'})
        expect(v.value).toBe('hello')
        expect(v.valueStr).toBe('hello')
        expect(v.cellValueOneof).toEqual({$case: 'str', str: 'hello'})
    })

    it('represents a numeric value', () => {
        const v = CellValue.from({type: 'number', value: 3.14})
        expect(v.value).toBe(3.14)
        expect(v.valueStr).toBe('3.14')
        expect(v.cellValueOneof).toEqual({$case: 'number', number: 3.14})
    })

    it('represents a boolean value', () => {
        const v = CellValue.from({type: 'bool', value: true})
        expect(v.value).toBe(true)
        expect(v.valueStr).toBe('true')
        expect(v.cellValueOneof).toEqual({$case: 'bool', bool: true})
    })

    it('represents an error value', () => {
        const v = CellValue.from({type: 'error', value: '#DIV/0!'})
        expect(v.value).toBe('#DIV/0!')
        expect(v.valueStr).toBe('#DIV/0!')
        expect(v.cellValueOneof).toEqual({$case: 'error', error: '#DIV/0!'})
    })
})

describe('Cell', () => {
    it('exposes cell text', () => {
        const cell = new Cell(makeCellInfo({type: 'str', value: 'world'}))
        expect(cell.getText()).toBe('world')
    })

    it('exposes the formula', () => {
        const cell = new Cell(makeCellInfo('empty', '=A1+B1'))
        expect(cell.getFormula()).toBe('=A1+B1')
    })

    it('exposes the style', () => {
        const cell = new Cell(makeCellInfo('empty'))
        expect(cell.getStyle()).toBe(emptyStyle)
    })

    it('exposes the block id', () => {
        const cell = new Cell(makeCellInfo('empty'))
        expect(cell.getBlockId()).toBe(7)
    })

    it('returns undefined block id when not set', () => {
        const cell = new Cell({value: 'empty', formula: '', style: emptyStyle})
        expect(cell.getBlockId()).toBeUndefined()
    })

    it('returns the original CellInfo', () => {
        const info = makeCellInfo({type: 'number', value: 42})
        const cell = new Cell(info)
        expect(cell.toCellInfo()).toBe(info)
    })
})
