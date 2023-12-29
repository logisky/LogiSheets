export interface InsertSheet {
    type: 'insertSheet'
    sheetIdx: number
    name: string
}

export class InsertSheetBuilder {
    private _sheetIdx?: number
    private _name?: string
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public name(name: string): this {
        this._name = name
        return this
    }
    public build(): InsertSheet {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._name === undefined) throw Error('name is undefined!')
        return {
            type: 'insertSheet',
            sheetIdx: this._sheetIdx,
            name: this._name,
        }
    }
}
