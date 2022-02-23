export interface SetColVisible {
    readonly type: 'setColVisible'
    readonly sheetIdx: number
    readonly col: number
    readonly visible: boolean
}

export class SetColVisibleBuilder {
    private  _sheetIdx?: number
    private  _col?: number
    private  _visible?: boolean
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public col(col: number): this {
        this._col = col
        return this
    }
    public visible(visible: boolean): this {
        this._visible = visible
        return this
    }
    public build(): SetColVisible {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')
        if (this._visible === undefined) throw Error('visible is undefined!')
        return {
            type: 'setColVisible',
            sheetIdx: this._sheetIdx,
            col: this._col,
            visible: this._visible,
        }
    }
}
