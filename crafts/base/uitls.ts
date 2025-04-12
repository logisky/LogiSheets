import {WORKBOOK} from './craft'
import type {Value, Result} from '../../packages/web'
import {isErrorMessage} from '../../packages/web'

export function getValueAssertString(
    sheetId: number,
    row: number,
    col: number
): string {
    const ws = WORKBOOK.getWorksheetById(sheetId)
    const value = ws.getValue(row, col)
    if (isErrorMessage(value)) {
        throw new Error(value.msg)
    }
    if (typeof value === 'object' && value !== null && 'str' in value) {
        return value.str
    }
    throw new Error('value is not a string')
}

export function getValueAssertBoolean(
    sheetId: number,
    _blockId: number,
    row: number,
    col: number
): boolean {
    const ws = WORKBOOK.getWorksheetById(sheetId)
    const value = ws.getValue(row, col)
    if (isErrorMessage(value)) {
        throw new Error(value.msg)
    }
    if (typeof value === 'object' && value !== null && 'bool' in value) {
        return value.bool
    }
    throw new Error('value is not a boolean')
}
