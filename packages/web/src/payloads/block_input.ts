export interface BlockInput {
    readonly type: 'blockInput'
    readonly sheetIdx: number
    readonly blockId: number
    readonly row: number
    readonly col: number
    readonly input: string
}

export class BlockInputBuilder {
    private _sheetIdx?: number
    private _row?: number
    private _col?: number
    private _input?: string
    private _blockId?: number

    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public row(row: number): this {
        this._row = row
        return this
    }
    public col(col: number): this {
        this._col = col
        return this
    }
    public input(input: string): this {
        this._input = input
        return this
    }
    public blockId(id: number): this {
        this._blockId = id
        return this
    }

    public build(): BlockInput {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')
        if (this._input === undefined) throw Error('input is undefined!')
        if (this._blockId === undefined) throw Error('block id is undefined')

        return {
            type: 'blockInput',
            sheetIdx: this._sheetIdx,
            row: this._row,
            col: this._col,
            input: this._input,
            blockId: this._blockId,
        }
    }
}
