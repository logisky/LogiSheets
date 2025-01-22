import {StPatternType} from '../bindings'

export interface SetCellPatternFill {
    readonly type: 'setCellPatternFill'
    readonly sheetIdx: number
    readonly row: number
    readonly col: number
    readonly fgColor?: string
    readonly bgColor?: string
    readonly pattern?: StPatternType
}

export class SetCellPatternFillBuilder {
    private _sheetIdx?: number
    private _row?: number
    private _col?: number
    private _fgColor?: string
    private _bgColor?: string
    private _pattern?: StPatternType
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
    public fgColor(c: string): this {
        this._fgColor = c
        return this
    }
    public bgColor(c: string): this {
        this._bgColor = c
        return this
    }
    public pattern(p: StPatternType): this {
        this._pattern = p
        return this
    }
    public build(): SetCellPatternFill {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')
        return {
            type: 'setCellPatternFill',
            sheetIdx: this._sheetIdx,
            row: this._row,
            col: this._col,
            fgColor: this._fgColor,
            bgColor: this._bgColor,
            pattern: this._pattern,
        }
    }
}
