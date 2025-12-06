import {Payload} from './payloads'
import {CellCoordinate} from './bindings'

export type RowId = number
export type ColId = number

export class Transaction {
    public constructor(
        public payloads: readonly Payload[],
        public readonly undoable: boolean
    ) {}
}

export class TransactionBuilder {
    public payload(p: Payload): this {
        this._payloads.push(p)
        return this
    }

    public undoable(v: boolean): this {
        this._undoable = v
        return this
    }

    public build(): Transaction {
        return new Transaction(this._payloads, this._undoable)
    }

    private _payloads: Payload[] = []
    private _undoable = true
}

export interface Selection {
    readonly sheetIdx: number
    readonly data: SelectedData
}

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

export function getFirstCell(v: SelectedData): CellCoordinate {
    const r = getSelectedCellRange(v)
    if (r) return {y: r.startRow, x: r.startCol}
    const l = getSelectedLines(v) as SelectedLines
    if (l.type === 'row') return {y: l.start, x: 0}
    if (l.type === 'col') return {y: 0, x: l.start}
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
