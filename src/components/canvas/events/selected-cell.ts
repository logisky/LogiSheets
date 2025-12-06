import {toA1notation} from '@/core'
import {SelectedData, SelectedCellRange, SelectedLines} from 'logisheets-web'

export function getSelectedCellRange(
    v: SelectedData
): SelectedCellRange | undefined {
    if (v.data?.ty === 'cellRange') return v.data.d
    return undefined
}

export function getSelectedLines(v: SelectedData): SelectedLines | undefined {
    if (v.data?.ty === 'line') return v.data.d
    return undefined
}

export function buildSelectedDataFromCell(
    row: number,
    col: number,
    source: 'editbar' | 'none'
): SelectedData {
    return {
        source,
        data: {
            ty: 'cellRange',
            d: {startRow: row, endRow: row, startCol: col, endCol: col},
        },
    }
}

export function buildSelectedDataFromCellRange(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    source: 'editbar' | 'none'
): SelectedData {
    return {
        source,
        data: {
            ty: 'cellRange',
            d: {startRow, endRow, startCol, endCol},
        },
    }
}

export function buildSelectedDataFromLines(
    start: number,
    end: number,
    type: 'row' | 'col',
    source: 'editbar' | 'none'
): SelectedData {
    return {
        source,
        data: {
            ty: 'line',
            d: {start, end, type},
        },
    }
}

export function getSelectedRows(v: SelectedData): number[] {
    if (v.data?.ty === 'cellRange') {
        return [v.data.d.startRow, v.data.d.endRow]
    }
    if (v.data?.ty === 'line' && v.data.d.type === 'row') {
        return [v.data.d.start, v.data.d.end]
    }
    return []
}

export function getSelectedColumns(v: SelectedData): number[] {
    if (v.data?.ty === 'cellRange') {
        return [v.data.d.startCol, v.data.d.endCol]
    }
    if (v.data?.ty === 'line' && v.data.d.type === 'col') {
        return [v.data.d.start, v.data.d.end]
    }
    return []
}

export function getReferenceString(v: SelectedData): string {
    if (v.data === undefined) return ''
    if (v.data.ty === 'cellRange') {
        const startRow = v.data.d.startRow
        const endRow = v.data.d.endRow
        const startCol = v.data.d.startCol
        const endCol = v.data.d.endCol
        if (startRow === endRow && startCol === endCol) {
            return `${toA1notation(startCol)}${startRow + 1}`
        }
        return `${toA1notation(startCol)}${startRow + 1}:${toA1notation(
            endCol
        )}${endRow + 1}`
    }

    if (v.data.ty === 'line') {
        if (v.data.d.type === 'col') {
            return `${toA1notation(v.data.d.start)}:${toA1notation(
                v.data.d.end
            )}`
        }
        return `${v.data.d.start + 1}:${v.data.d.end + 1}`
    }
    return ''
}
