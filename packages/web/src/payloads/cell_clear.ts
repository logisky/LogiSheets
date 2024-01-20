export interface CellClear {
    readonly type: 'cellClear'
    readonly sheetIdx: number
    readonly row: number
    readonly col: number
}

export class CellClearBuilder {
    private _sheetIdx?: number
    private _row?: number
    private _col?: number
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
    public build(): CellClear {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')

        return {
            type: 'cellClear',
            sheetIdx: this._sheetIdx,
            row: this._row,
            col: this._col,
        }
    }
}
