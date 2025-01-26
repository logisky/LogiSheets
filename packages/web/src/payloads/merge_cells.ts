export interface MergeCells {
    readonly type: 'mergeCells'
    readonly sheetIdx: number
    readonly startRow: number
    readonly startCol: number
    readonly endRow: number
    readonly endCol: number
}

export class MergeCellsBuilder {
    private _sheetIdx?: number
    private _startRow?: number
    private _startCol?: number
    private _endRow?: number
    private _endCol?: number

    public sheetIdx(v: number): this {
        this._sheetIdx = v
        return this
    }
    public startRow(v: number): this {
        this._startRow = v
        return this
    }
    public startCol(v: number): this {
        this._startCol = v
        return this
    }
    public endRow(v: number): this {
        this._endRow = v
        return this
    }
    public endCol(v: number): this {
        this._endCol = v
        return this
    }
    public build(): MergeCells {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._startRow === undefined) throw Error('startRow is undefined')
        if (this._startCol === undefined) throw Error('startCol is undefined')
        if (this._endRow === undefined) throw Error('endRow is undefined')
        if (this._endCol === undefined) throw Error('endCol is undefined')
        return {
            type: 'mergeCells',
            sheetIdx: this._sheetIdx,
            startRow: this._startRow,
            startCol: this._startCol,
            endRow: this._endRow,
            endCol: this._endCol,
        }
    }
}
