import {CellCoordinate} from './bindings'

/** Stable ids of a block's lines; they survive inserts and reorders, unlike
 *  indexes. See `Workbook.getBlockRowId` / `getBlockColId`. */
export type RowId = number
export type ColId = number

/** What the user has selected on one sheet (0-based indexes). */
export interface Selection {
    readonly sheetIdx: number
    readonly data: SelectedData
}

/** Either whole rows/columns or a cell rectangle; `data` is absent when
 *  nothing is selected. */
export interface SelectedData {
    readonly data?:
        | {ty: 'line'; d: SelectedLines}
        | {ty: 'cellRange'; d: SelectedCellRange}
    readonly source: 'editbar' | 'none'
}

/** A cell rectangle; both bounds inclusive. */
export interface SelectedCellRange {
    readonly startRow: number
    readonly endRow: number
    readonly startCol: number
    readonly endCol: number
}

export interface SelectedLines {
    readonly start: number
    // inclusive
    readonly end: number
    readonly type: 'row' | 'col'
}

/** Top-left cell of the selection (`y` = row, `x` = column). Throws when
 *  nothing is selected. */
export function getFirstCell(v: SelectedData): CellCoordinate {
    const r = getSelectedCellRange(v)
    if (r) return {y: r.startRow, x: r.startCol}
    const l = getSelectedLines(v)
    if (l?.type === 'row') return {y: l.start, x: 0}
    if (l?.type === 'col') return {y: 0, x: l.start}
    throw Error('should not happend')
}

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
