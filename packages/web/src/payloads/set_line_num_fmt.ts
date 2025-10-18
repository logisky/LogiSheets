export interface SetLineNumFmt {
    readonly sheetIdx: number
    readonly row: boolean
    readonly from: number
    readonly to: number
    readonly numFmt: string
}

export class SetLineNumFmtBuilder {
    private _sheetIdx?: number
    private _row?: boolean
    private _from?: number
    private _to?: number
    private _numFmt?: string
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public row(row: boolean): this {
        this._row = row
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
    public numFmt(numFmt: string): this {
        this._numFmt = numFmt
        return this
    }
    public build(): SetLineNumFmt {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._from === undefined) throw Error('from is undefined!')
        if (this._to === undefined) throw Error('to is undefined!')
        if (this._numFmt === undefined) throw Error('numFmt is undefined!')
        return {
            sheetIdx: this._sheetIdx,
            row: this._row,
            from: this._from,
            to: this._to,
            numFmt: this._numFmt,
        }
    }
}
