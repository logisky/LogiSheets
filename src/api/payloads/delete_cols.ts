export interface DeleteCols {
    readonly type: 'deleteCols'
    readonly sheetIdx: number
    readonly start: number
    readonly cnt: number
}

export class DeleteColsBuilder {
    private _sheetIdx?: number
    private _start?: number
    private _cnt?: number
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }

    public start(start: number): this {
        this._start = start
        return this
    }
    public cnt(cnt: number): this {
        this._cnt = cnt
        return this
    }

    public build(): DeleteCols {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._start === undefined) throw Error('start is undefined!')
        if (this._cnt === undefined) throw Error('cnt is undefined!')
        return {
            type: 'deleteCols',
            sheetIdx: this._sheetIdx,
            start: this._start,
            cnt: this._cnt,
        }
    }
}
