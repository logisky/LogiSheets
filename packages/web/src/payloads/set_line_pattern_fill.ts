import {StPatternType} from '../bindings'

export interface SetLinePatternFill {
    readonly sheetIdx: number
    readonly row: boolean
    readonly from: number
    readonly to: number
    readonly fgColor?: string
    readonly bgColor?: string
    readonly pattern?: StPatternType
}

export class SetLinePatternFillBuilder {
    private _sheetIdx?: number
    private _row?: boolean
    private _from?: number
    private _to?: number
    private _fgColor?: string
    private _bgColor?: string
    private _pattern?: StPatternType

    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }
    public from(v: number): this {
        this._from = v
        return this
    }
    public to(v: number): this {
        this._to = v
        return this
    }
    public row(v: boolean): this {
        this._row = v
        return this
    }
    public fgColor(v: string): this {
        this._fgColor = v
        return this
    }
    public bgColor(v: string): this {
        this._bgColor = v
        return this
    }
    public pattern(v: StPatternType): this {
        this._pattern = v
        return this
    }

    public build(): SetLinePatternFill {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._from === undefined) throw Error('from is undefined!')
        if (this._to === undefined) throw Error('to is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        return {
            sheetIdx: this._sheetIdx,
            from: this._from,
            to: this._to,
            row: this._row,
            fgColor: this._fgColor,
            bgColor: this._bgColor,
            pattern: this._pattern,
        }
    }
}
