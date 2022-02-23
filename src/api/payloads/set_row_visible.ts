
export interface SetRowVisible {
    readonly type: 'setRowVisible'
    readonly sheetIdx: number
    readonly row: number
    readonly visible: boolean
}

export class SetRowVisibleBuilder {
    private  _sheetIdx?: number
    private  _row?: number
    private  _visible?: boolean
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public row(row: number): this {
        this._row = row
        return this
    }
    public visible(visible: boolean): this {
        this._visible = visible
        return this
    }
    public build(): SetRowVisible {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._visible === undefined) throw Error('visible is undefined!')
        return {
            type: 'setRowVisible',
            sheetIdx: this._sheetIdx,
            row: this._row,
            visible: this._visible,
        }
    }
}
