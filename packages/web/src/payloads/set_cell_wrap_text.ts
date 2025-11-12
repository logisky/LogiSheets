export interface SetCellWrapText {
    readonly sheetIdx: number
    readonly row: number
    readonly col: number
    readonly wrapText: boolean
}

export class SetCellWrapTextBuilder {
    private _sheetIdx?: number
    private _row?: number
    private _col?: number
    private _wrapText?: boolean
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
    public wrapText(value: boolean): this {
        this._wrapText = value
        return this
    }
    public build(): SetCellWrapText {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')
        if (this._wrapText === undefined) throw Error('wrapText is undefined!')
        return {
            sheetIdx: this._sheetIdx,
            row: this._row,
            col: this._col,
            wrapText: this._wrapText,
        }
    }
}
