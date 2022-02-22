export interface SetColWidth {
    readonly type: 'setColWidth'
    readonly sheetIdx: number
    readonly col: number
    readonly width: number
}

export class SetColWidthBuilder {
    private _sheetIdx?: number
    private _col?: number
    private _width?: number
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public col(col: number): this {
        this._col = col
        return this
    }
    public width(width: number): this {
        this._width = width
        return this
    }
    public build(): SetColWidth {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')
        if (this._width === undefined) throw Error('width is undefined!')
        return {
            type: 'setColWidth',
            sheetIdx: this._sheetIdx,
            col: this._col,
            width: this._width,
        }
    }
}
