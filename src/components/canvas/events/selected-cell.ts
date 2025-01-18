export interface SelectedData {
    readonly data?:
        | {ty: 'line'; d: SelectedLines}
        | {ty: 'cellRange'; d: SelectedCellRange}
    readonly source: 'editbar' | 'none'
}

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

export interface CellCoordinate {
    r: number
    c: number
}

export function getFirstCell(v: SelectedData): CellCoordinate {
    const r = getSelectedCellRange(v)
    if (r) return {r: r.startRow, c: r.startCol}
    const l = getSelectedLines(v) as SelectedLines
    if (l.type === 'row') return {r: l.start, c: 0}
    if (l.type === 'col') return {r: 0, c: l.start}
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
