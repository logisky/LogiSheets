import {StBorderStyle} from '../bindings'

export interface SetLineBorder {
    readonly type: 'setLineBorder'
    readonly sheetIdx: number
    readonly line: number
    readonly row: boolean
    readonly leftColor?: string
    readonly rightColor?: string
    readonly topColor?: string
    readonly bottomColor?: string
    readonly leftBorderType?: StBorderStyle
    readonly rightBorderType?: StBorderStyle
    readonly topBorderType?: StBorderStyle
    readonly bottomBorderType?: StBorderStyle
    readonly outline?: boolean
    readonly diagonalUp?: boolean
    readonly diagonalDown?: boolean
}

export class SetLineBorderBuilder {
    private _sheetIdx?: number
    private _row?: boolean
    private _line?: number
    private _leftColor?: string
    private _rightColor?: string
    private _topColor?: string
    private _bottomColor?: string
    private _leftBorderType?: StBorderStyle
    private _rightBorderType?: StBorderStyle
    private _topBorderType?: StBorderStyle
    private _bottomBorderType?: StBorderStyle
    private _outline?: boolean
    private _diagonalUp?: boolean
    private _diagonalDown?: boolean

    public sheetIdx(sheetIdx: number): this {
        this._sheetIdx = sheetIdx
        return this
    }

    public row(v: boolean): this {
        this._row = v
        return this
    }

    public line(v: number): this {
        this._line = v
        return this
    }
    public leftColor(v: string): this {
        this._leftColor = v
        return this
    }
    public rightColor(v: string): this {
        this._rightColor = v
        return this
    }
    public topColor(v: string): this {
        this._topColor = v
        return this
    }
    public bottomColor(v: string): this {
        this._bottomColor = v
        return this
    }
    public leftBorderType(v: StBorderStyle): this {
        this._leftBorderType = v
        return this
    }
    public rightBorderType(v: StBorderStyle): this {
        this._rightBorderType = v
        return this
    }
    public topBorderType(v: StBorderStyle): this {
        this._topBorderType = v
        return this
    }
    public bottomBorderType(v: StBorderStyle): this {
        this._bottomBorderType = v
        return this
    }
    public outline(v: boolean): this {
        this._outline = v
        return this
    }
    public diagonalUp(v: boolean): this {
        this._diagonalUp = v
        return this
    }
    public diagonalDown(v: boolean): this {
        this._diagonalDown = v
        return this
    }

    public build(): SetLineBorder {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined!')
        if (this._line === undefined) throw Error('line is undefined')
        if (this._row === undefined) throw Error('row is undefined')
        return {
            type: 'setLineBorder',
            sheetIdx: this._sheetIdx,
            line: this._line,
            row: this._row,
            leftColor: this._leftColor,
            rightColor: this._rightColor,
            topColor: this._topColor,
            bottomColor: this._bottomColor,
            leftBorderType: this._leftBorderType,
            rightBorderType: this._rightBorderType,
            topBorderType: this._topBorderType,
            bottomBorderType: this._bottomBorderType,
            outline: this._outline,
            diagonalUp: this._diagonalUp,
            diagonalDown: this._diagonalDown,
        }
    }
}
