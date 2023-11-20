export interface MoveBlock {
    readonly type: 'moveBlock'
    readonly sheetIdx: number
    readonly blockId: number
    readonly newMasterRow: number
    readonly newMasterCol: number
}

export class MoveBlockBuilder {
    private _sheetIdx?: number
    private _blockId?: number
    private _newMasterRow?: number
    private _newMasterCol?: number
    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public blockId(blockId: number): this {
        this._blockId = blockId
        return this
    }
    public newMasterRow(newMasterRow: number): this {
        this._newMasterRow = newMasterRow
        return this
    }
    public newMasterCol(newMasterCol: number): this {
        this._newMasterCol = newMasterCol
        return this
    }
    public build(): MoveBlock {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._blockId === undefined) throw Error('blockId is undefined!')
        if (this._newMasterRow === undefined)
            throw Error('newMasterRow is undefined!')
        if (this._newMasterCol === undefined)
            throw Error('newMasterCol is undefined!')
        return {
            type: 'moveBlock',
            sheetIdx: this._sheetIdx,
            blockId: this._blockId,
            newMasterRow: this._newMasterRow,
            newMasterCol: this._newMasterCol,
        }
    }
}
