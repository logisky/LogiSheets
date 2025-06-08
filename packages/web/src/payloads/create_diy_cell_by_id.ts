export interface CreateDiyCellById {
    readonly type: 'createDiyCellById'
    readonly sheetId: number
    readonly blockId: number
    readonly rowIdx: number
    readonly colIdx: number
}

export class CreateDiyCellByIdBuilder {
    private _sheetId?: number
    private _blockId?: number
    private _rowIdx?: number
    private _colIdx?: number

    public sheetId(sheetId: number): this {
        this._sheetId = sheetId
        return this
    }
    public blockId(blockId: number): this {
        this._blockId = blockId
        return this
    }
    public rowIdx(rowIdx: number): this {
        this._rowIdx = rowIdx
        return this
    }
    public colIdx(colIdx: number): this {
        this._colIdx = colIdx
        return this
    }
    public build(): CreateDiyCellById {
        if (this._sheetId === undefined) throw Error('sheetId is undefined')
        if (this._blockId === undefined) throw Error('blockId is undefined')
        if (this._rowIdx === undefined) throw Error('rowIdx is undefined')
        if (this._colIdx === undefined) throw Error('colIdx is undefined')
        return {
            type: 'createDiyCellById',
            sheetId: this._sheetId,
            blockId: this._blockId,
            rowIdx: this._rowIdx,
            colIdx: this._colIdx,
        }
    }
}
