export interface SetBlockLineNumFmt {
    readonly sheetIdx: number
    readonly blockId: number
    readonly from: number
    readonly to: number
    readonly isRow: boolean
    readonly numFmt: string
}

export class SetBlockLineNumFmtBuilder {
    private _sheetIdx?: number
    private _blockId?: number
    private _from?: number
    private _to?: number
    private _isRow?: boolean
    private _numFmt?: string
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public blockId(blockId: number): this {
        this._blockId = blockId
        return this
    }
    public from(from: number): this {
        this._from = from
        return this
    }
    public to(to: number): this {
        this._to = to
        return this
    }
    public isRow(isRow: boolean): this {
        this._isRow = isRow
        return this
    }
    public numFmt(numFmt: string): this {
        this._numFmt = numFmt
        return this
    }
    public build(): SetBlockLineNumFmt {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._blockId === undefined) throw Error('blockId is undefined!')
        if (this._from === undefined) throw Error('from is undefined!')
        if (this._to === undefined) throw Error('to is undefined!')
        if (this._isRow === undefined) throw Error('isRow is undefined!')
        if (this._numFmt === undefined) throw Error('numFmt is undefined!')
        return {
            sheetIdx: this._sheetIdx,
            blockId: this._blockId,
            from: this._from,
            to: this._to,
            isRow: this._isRow,
            numFmt: this._numFmt,
        }
    }
}
