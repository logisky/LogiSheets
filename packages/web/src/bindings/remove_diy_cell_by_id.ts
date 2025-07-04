// DO NOT EDIT. CODE GENERATED BY gents.
export interface RemoveDiyCellById {
    type: 'removeDiyCellById'
    sheetId: number
    blockId: number
    rowIdx: number
    colIdx: number
}

export class RemoveDiyCellByIdBuilder {
    private _type = 'removeDiyCellById'
    private _sheetId!: number
    private _blockId!: number
    private _rowIdx!: number
    private _colIdx!: number
    public sheetId(value: number) {
        this._sheetId = value
        return this
    }

    public blockId(value: number) {
        this._blockId = value
        return this
    }

    public rowIdx(value: number) {
        this._rowIdx = value
        return this
    }

    public colIdx(value: number) {
        this._colIdx = value
        return this
    }

    public build() {
        if (this._sheetId === undefined) throw new Error('missing sheetId')
        if (this._blockId === undefined) throw new Error('missing blockId')
        if (this._rowIdx === undefined) throw new Error('missing rowIdx')
        if (this._colIdx === undefined) throw new Error('missing colIdx')
        return {
            type: this._type,
            sheetId: this._sheetId,
            blockId: this._blockId,
            rowIdx: this._rowIdx,
            colIdx: this._colIdx
        }
    }
}
