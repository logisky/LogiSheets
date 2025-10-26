import {FieldType} from '../bindings'

export interface SetBlockLineNameField {
    readonly sheetIdx: number
    readonly blockId: number
    readonly line: number
    readonly isRow: boolean
    readonly name: string
    readonly type: FieldType
}

export class SetBlockLineNameFieldBuilder {
    private _sheetIdx!: number
    private _blockId!: number
    private _line!: number
    private _isRow!: boolean
    private _name!: string
    private _type!: FieldType
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

    public type(value: FieldType) {
        this._type = value
        return this
    }
    public build() {
        if (this._sheetIdx === undefined) throw new Error('missing sheetIdx')
        if (this._blockId === undefined) throw new Error('missing blockId')
        if (this._line === undefined) throw new Error('missing line')
        if (this._isRow === undefined) throw new Error('missing isRow')
        if (this._name === undefined) throw new Error('missing name')
        if (this._type === undefined) throw new Error('missing type')
        return {
            sheetIdx: this._sheetIdx,
            blockId: this._blockId,
            line: this._line,
            isRow: this._isRow,
            name: this._name,
            type: this._type,
        }
    }
}
