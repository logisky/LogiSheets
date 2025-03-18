export interface LineFormatBrush {
    readonly type: 'lineFormatBrush'
    readonly srcSheetIdx: number
    readonly srcRow: number
    readonly srcCol: number
    readonly dstSheetIdx: number
    readonly row: boolean
    readonly from: number
    readonly to: number
}

export class LineFormatBrushBuilder {
    private _srcSheetIdx?: number
    private _srcRow?: number
    private _srcCol?: number
    private _dstSheetIdx?: number
    private _row?: boolean
    private _from?: number
    private _to?: number

    public srcSheetIdx(srcSheetIdx: number): this {
        this._srcSheetIdx = srcSheetIdx
        return this
    }

    public dstSheetIdx(dstSheetIdx: number): this {
        this._dstSheetIdx = dstSheetIdx
        return this
    }

    public srcRow(srcRow: number): this {
        this._srcRow = srcRow
        return this
    }

    public srcCol(srcCol: number): this {
        this._srcCol = srcCol
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

    public build(): LineFormatBrush {
        if (this._srcSheetIdx === undefined)
            throw Error('srcSheetIdx is undefined!')
        if (this._srcRow === undefined) throw Error('srcRow is undefined!')
        if (this._srcCol === undefined) throw Error('srcCol is undefined!')
        if (this._dstSheetIdx === undefined)
            throw Error('dstSheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._from === undefined) throw Error('from is undefined!')
        if (this._to === undefined) throw Error('to is undefined!')

        return {
            type: 'lineFormatBrush',
            srcSheetIdx: this._srcSheetIdx,
            srcRow: this._srcRow,
            srcCol: this._srcCol,
            dstSheetIdx: this._dstSheetIdx,
            row: this._row,
            from: this._from,
            to: this._to,
        }
    }
}
