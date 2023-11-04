export interface SetRowHeight {
    readonly type: 'setRowHeight'
    readonly sheetIdx: number
    readonly row: number
    readonly height: number
}

export class SetRowHeightBuilder {
    private _sheetIdx?: number
    private _row?: number
    private _height?: number
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public row(row: number): this {
        this._row = row
        return this
    }
    public height(height: number): this {
        this._height = height
        return this
    }
    public build(): SetRowHeight {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._height === undefined) throw Error('height is undefined!')
        return {
            type: 'setRowHeight',
            sheetIdx: this._sheetIdx,
            row: this._row,
            height: this._height,
        }
    }
}
