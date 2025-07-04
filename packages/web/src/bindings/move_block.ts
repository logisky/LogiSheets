// DO NOT EDIT. CODE GENERATED BY gents.
export interface MoveBlock {
    type: 'moveBlock'
    sheetIdx: number
    id: number
    newMasterRow: number
    newMasterCol: number
}

export class MoveBlockBuilder {
    private _type = 'moveBlock'
    private _sheetIdx!: number
    private _id!: number
    private _newMasterRow!: number
    private _newMasterCol!: number
    public sheetIdx(value: number) {
        this._sheetIdx = value
        return this
    }

    public id(value: number) {
        this._id = value
        return this
    }

    public newMasterRow(value: number) {
        this._newMasterRow = value
        return this
    }

    public newMasterCol(value: number) {
        this._newMasterCol = value
        return this
    }

    public build() {
        if (this._sheetIdx === undefined) throw new Error('missing sheetIdx')
        if (this._id === undefined) throw new Error('missing id')
        if (this._newMasterRow === undefined) {
            throw new Error('missing newMasterRow')
        }
        if (this._newMasterCol === undefined) {
            throw new Error('missing newMasterCol')
        }
        return {
            type: this._type,
            sheetIdx: this._sheetIdx,
            id: this._id,
            newMasterRow: this._newMasterRow,
            newMasterCol: this._newMasterCol
        }
    }
}
