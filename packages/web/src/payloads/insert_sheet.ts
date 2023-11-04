export interface InsertSheet {
    type: 'insertSheet'
    sheetIdx: number
}

export class InsertSheetBuilder {
    private _sheetIdx?: number
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public build(): InsertSheet {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        return {
            type: 'insertSheet',
            sheetIdx: this._sheetIdx,
        }
    }
}
