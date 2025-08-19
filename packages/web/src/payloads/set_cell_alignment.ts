import {Alignment} from '../bindings'

export interface SetCellAlignment {
    readonly sheetIdx: number
    readonly row: number
    readonly col: number
    readonly alignment: Alignment
}

export class SetCellAlignmentBuilder {
    private _sheetIdx?: number
    private _row?: number
    private _col?: number
    private _alignment?: Alignment
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public row(row: number): this {
        this._row = row
        return this
    }
    public col(col: number): this {
        this._col = col
        return this
    }
    public alignment(value: Alignment): this {
        this._alignment = value
        return this
    }

    public build(): SetCellAlignment {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')
        if (this._alignment === undefined)
            throw Error('alignment is undefined!')
        return {
            sheetIdx: this._sheetIdx,
            row: this._row,
            col: this._col,
            alignment: this._alignment,
        }
    }
}
