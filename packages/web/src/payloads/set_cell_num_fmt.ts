export interface SetCellNumFmt {
    readonly sheetIdx: number
    readonly row: number
    readonly col: number
    readonly numFmt: string
}

export class SetCellNumFmtBuilder {
    private _sheetIdx?: number
    private _row?: number
    private _col?: number
    private _numFmt?: string
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
    public numFmt(numFmt: string): this {
        this._numFmt = numFmt
        return this
    }
    public build(): SetCellNumFmt {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')
        if (this._numFmt === undefined) throw Error('numFmt is undefined!')
        return {
            sheetIdx: this._sheetIdx,
            row: this._row,
            col: this._col,
            numFmt: this._numFmt,
        }
    }
}
