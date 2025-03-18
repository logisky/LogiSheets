export interface CellFormatBrush {
    readonly type: 'cellFormatBrush'
    readonly srcSheetIdx: number
    readonly srcRow: number
    readonly srcCol: number
    readonly dstSheetIdx: number
    readonly dstRowStart: number
    readonly dstColStart: number
    readonly dstRowEnd: number
    readonly dstColEnd: number
}

export class CellFormatBrushBuilder {
    private _srcSheetIdx?: number
    private _srcRow?: number
    private _srcCol?: number
    private _dstSheetIdx?: number
    private _dstRowStart?: number
    private _dstColStart?: number
    private _dstRowEnd?: number
    private _dstColEnd?: number

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
    public dstRowStart(dstRowStart: number): this {
        this._dstRowStart = dstRowStart
        return this
    }
    public dstColStart(dstColStart: number): this {
        this._dstColStart = dstColStart
        return this
    }
    public dstRowEnd(dstRowEnd: number): this {
        this._dstRowEnd = dstRowEnd
        return this
    }
    public dstColEnd(dstColEnd: number): this {
        this._dstColEnd = dstColEnd
        return this
    }
    public build(): CellFormatBrush {
        if (this._srcSheetIdx === undefined)
            throw Error('srcSheetIdx is undefined!')
        if (this._srcRow === undefined) throw Error('srcRow is undefined!')
        if (this._srcCol === undefined) throw Error('srcCol is undefined!')
        if (this._dstSheetIdx === undefined)
            throw Error('dstSheetIdx is undefined!')
        if (this._dstRowStart === undefined)
            throw Error('dstRowStart is undefined!')
        if (this._dstColStart === undefined)
            throw Error('dstColStart is undefined!')
        if (this._dstRowEnd === undefined)
            throw Error('dstRowEnd is undefined!')
        if (this._dstColEnd === undefined)
            throw Error('dstColEnd is undefined!')

        return {
            type: 'cellFormatBrush',
            srcSheetIdx: this._srcSheetIdx,
            srcRow: this._srcRow,
            srcCol: this._srcCol,
            dstSheetIdx: this._dstSheetIdx,
            dstRowStart: this._dstRowStart,
            dstColStart: this._dstColStart,
            dstRowEnd: this._dstRowEnd,
            dstColEnd: this._dstColEnd,
        }
    }
}
