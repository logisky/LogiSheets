import {Alignment} from '../bindings'

export interface SetLineAlignment {
    readonly sheetIdx: number
    readonly row: boolean
    readonly from: number
    readonly to: number
    readonly alignment: Alignment
}

export class SetLineAlignmentBuilder {
    private _sheetIdx?: number
    private _row?: boolean
    private _from?: number
    private _to?: number
    private _alignment?: Alignment

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
    public alignment(v: Alignment): this {
        this._alignment = v
        return this
    }

    public build(): SetLineAlignment {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._from === undefined) throw Error('from is undefined!')
        if (this._to === undefined) throw Error('to is undefined!')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._alignment === undefined)
            throw Error('alignment is undefined!')
        return {
            sheetIdx: this._sheetIdx,
            from: this._from,
            to: this._to,
            row: this._row,
            alignment: this._alignment,
        }
    }
}
