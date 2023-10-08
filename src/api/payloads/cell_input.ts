export interface CellInput {
    readonly type: 'cellInput'
    readonly sheetIdx: number
    readonly row: number
    readonly col: number
    readonly input: string
}

export class CellInputBuilder {
    private _sheetIdx?: number
    private _row?: number
    private _col?: number
    private _input?: string
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
    public build(): CellInput {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')
        if (this._input === undefined) throw Error('input is undefined!')

        return {
            type: 'cellInput',
            sheetIdx: this._sheetIdx,
            row: this._row,
            col: this._col,
            input: this._input,
        }
    }
}
