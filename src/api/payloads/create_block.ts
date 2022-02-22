export interface CreateBlock {
    readonly type: 'createBlock'
    readonly sheetIdx: number
    readonly blockId: number
    readonly masterRow: number
    readonly masterCol: number
    readonly rowCnt: number
    readonly colCnt: number
}

export class CreateBlockBuilder {
    private _sheetIdx?: number
    private _blockId?: number
    private _masterRow?: number
    private _masterCol?: number
    private _rowCnt?: number
    private _colCnt?: number

    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public blockId(blockId: number): this {
        this._blockId = blockId
        return this
    }

    public masterRow(masterRow: number): this {
        this._masterRow = masterRow
        return this
    }

    public masterCol(masterCol: number): this {
        this._masterCol = masterCol
        return this
    }

    public rowCnt(rowCnt: number): this {
        this._rowCnt = rowCnt
        return this
    }

    public colCnt(colCnt: number): this {
        this._colCnt = colCnt
        return this
    }

    public build(): CreateBlock {
        if (this._sheetIdx === undefined) { throw Error('sheetIdx is undefined!')}
        if (this._blockId === undefined) { throw Error('blockId is undefined!')}
        if (this._masterRow === undefined) { throw Error('masterRow is undefined!')}
        if (this._masterCol === undefined) { throw Error('masterCol is undefined!')}
        if (this._rowCnt === undefined) { throw Error('rowCnt is undefined!')}
        if (this._colCnt === undefined) { throw Error('colCnt is undefined!')}

        return {
            type: 'createBlock',
            sheetIdx: this._sheetIdx,
            blockId: this._blockId,
            masterRow: this._masterRow,
            masterCol: this._masterCol,
            rowCnt: this._rowCnt,
            colCnt: this._colCnt,
        }
    }
}
