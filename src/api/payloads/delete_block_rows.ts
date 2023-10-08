export interface DeleteBlockRows {
    readonly type: 'deleteBlockRows'
    readonly sheetIdx: number
    readonly blockId: number
    readonly rowIdx: number
    readonly cnt: number
}

export class DeleteBlockRowsBuilder {
    private _sheetIdx?: number
    private _blockId?: number
    private _rowIdx?: number
    private _cnt?: number

    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
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
    public cnt(cnt: number): this {
        this._cnt = cnt
        return this
    }
    public build(): DeleteBlockRows {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined')
        if (this._blockId === undefined) throw Error('blockId is undefined')
        if (this._rowIdx === undefined) throw Error('rowIdx is undefined')
        if (this._cnt === undefined) throw Error('cnt is undefined')
        return {
            type: 'deleteBlockRows',
            sheetIdx: this._sheetIdx,
            blockId: this._blockId,
            rowIdx: this._rowIdx,
            cnt: this._cnt,
        }
    }
}
