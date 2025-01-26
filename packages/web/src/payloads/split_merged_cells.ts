export interface SplitMergedCells {
    readonly type: 'splitMergedCells'
    readonly sheetIdx: number
    readonly row: number
    readonly col: number
}

export class SplitMergedCellsBuilder {
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

    public build(): SplitMergedCells {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined')
        if (this._row === undefined) throw Error('row is undefined')
        if (this._col === undefined) throw Error('col is undefined')
        return {
            type: 'splitMergedCells',
            sheetIdx: this._sheetIdx,
            row: this._row,
            col: this._col,
        }
    }
}
