
export interface InsertBlockCols {
    readonly type: 'insertBlockCols'
    readonly sheetIdx: number
    readonly blockId: number
    readonly colIdx: number
    readonly cnt: number
}

export class InsertBlockColsBuilder {
    private _sheetIdx?: number
    private _blockId?: number
    private _colIdx?: number
    private _cnt?: number

    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public blockId(blockId: number): this {
        this._blockId = blockId
        return this
    }
    public colIdx(colIdx: number): this {
        this._colIdx = colIdx
        return this
    }
    public cnt(cnt: number): this {
        this._cnt = cnt
        return this
    }
    public build(): InsertBlockCols {

        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._blockId === undefined) throw Error('blockId is undefined!')
        if (this._colIdx === undefined) throw Error('colIdx is undefined!')
        if (this._cnt === undefined) throw Error('cnt is undefined!')
        return {
            type: 'insertBlockCols',
            sheetIdx: this._sheetIdx,
            blockId: this._blockId,
            colIdx: this._colIdx,
            cnt: this._cnt,
        }
    }
}