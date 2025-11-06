export interface SetBlockLineNameField {
    readonly sheetIdx: number
    readonly blockId: number
    readonly line: number
    readonly isRow: boolean
    readonly name: string
    readonly fieldId: string
    readonly diyRender: boolean
}

export class SetBlockLineNameFieldBuilder {
    private _sheetIdx!: number
    private _blockId!: number
    private _line!: number
    private _isRow!: boolean
    private _name!: string
    private _fieldId!: string
    private _diyRender!: boolean
    public sheetIdx(value: number) {
        this._sheetIdx = value
        return this
    }

    public blockId(value: number) {
        this._blockId = value
        return this
    }

    public line(value: number) {
        this._line = value
        return this
    }

    public isRow(value: boolean) {
        this._isRow = value
        return this
    }

    public name(value: string) {
        this._name = value
        return this
    }

    public fieldId(value: string) {
        this._fieldId = value
        return this
    }

    public diyRender(value: boolean) {
        this._diyRender = value
        return this
    }
    public build() {
        if (this._sheetIdx === undefined) throw new Error('missing sheetIdx')
        if (this._blockId === undefined) throw new Error('missing blockId')
        if (this._line === undefined) throw new Error('missing line')
        if (this._isRow === undefined) throw new Error('missing isRow')
        if (this._name === undefined) throw new Error('missing name')
        if (this._fieldId === undefined) throw new Error('missing fieldId')
        if (this._diyRender === undefined) throw new Error('missing diyRender')
        return {
            sheetIdx: this._sheetIdx,
            blockId: this._blockId,
            line: this._line,
            isRow: this._isRow,
            name: this._name,
            fieldId: this._fieldId,
            diyRender: this._diyRender,
        }
    }
}
