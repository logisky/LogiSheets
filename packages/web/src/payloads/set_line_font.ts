import {StUnderlineValues as UnderlineType} from '../bindings'

export interface SetLineFont {
    readonly sheetIdx: number
    readonly row: boolean
    readonly from: number
    readonly to: number
    readonly bold?: boolean
    readonly italic?: boolean
    readonly name?: string
    readonly underline?: UnderlineType
    readonly color?: string
    readonly size?: number
    readonly outline?: boolean
    readonly shadow?: boolean
    readonly strike?: boolean
    readonly condense?: boolean
}

export class SetLineFontBuilder {
    private _sheetIdx?: number
    private _row?: boolean
    private _from?: number
    private _to?: number
    private _bold?: boolean
    private _italic?: boolean
    private _name?: string
    private _underline?: UnderlineType
    private _color?: string
    private _size?: number
    private _outline?: boolean
    private _shadow?: boolean
    private _strike?: boolean
    private _condense?: boolean

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
    public bold(bold: boolean): this {
        this._bold = bold
        return this
    }
    public italic(italic: boolean): this {
        this._italic = italic
        return this
    }
    public name(name: string): this {
        this._name = name
        return this
    }
    public underline(underline: UnderlineType): this {
        this._underline = underline
        return this
    }
    public color(color: string): this {
        this._color = color
        return this
    }
    public size(size: number): this {
        this._size = size
        return this
    }
    public outline(outline: boolean): this {
        this._outline = outline
        return this
    }
    public shadow(shadow: boolean): this {
        this._shadow = shadow
        return this
    }
    public strike(strike: boolean): this {
        this._strike = strike
        return this
    }
    public condense(condense: boolean): this {
        this._condense = condense
        return this
    }

    public build(): SetLineFont {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._from === undefined) throw Error('from is undefined!')
        if (this._to === undefined) throw Error('to is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        return {
            sheetIdx: this._sheetIdx,
            from: this._from,
            to: this._to,
            row: this._row,
            bold: this._bold,
            italic: this._italic,
            underline: this._underline,
            color: this._color,
            size: this._size,
            outline: this._outline,
            shadow: this._shadow,
            strike: this._strike,
            condense: this._condense,
            name: this._name,
        }
    }
}
