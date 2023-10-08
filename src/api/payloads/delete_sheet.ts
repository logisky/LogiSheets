export interface DeleteSheet {
    type: 'deleteSheet'
    sheetIdx: number
}

export class DeleteSheetBuilder {
    private _sheetIdx?: number
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public build(): DeleteSheet {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        return {
            type: 'deleteSheet',
            sheetIdx: this._sheetIdx,
        }
    }
}
