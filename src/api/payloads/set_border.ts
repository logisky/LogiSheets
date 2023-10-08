import {StBorderStyle} from '@/bindings'
export interface SetBorder {
    readonly type: 'setBorder'
    readonly sheetIdx: number
    readonly row: number
    readonly col: number
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

export class SetBorderBuilder {
    private _sheetIdx?: number
    private _row?: number
    private _col?: number
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
    public row(row: number): this {
        this._row = row
        return this
    }
    public col(col: number): this {
        this._col = col
        return this
    }
    public leftColor(leftColor: string): this {
        this._leftColor = leftColor
        return this
    }
    public rightColor(rightColor: string): this {
        this._rightColor = rightColor
        return this
    }
    public topColor(topColor: string): this {
        this._topColor = topColor
        return this
    }
    public bottomColor(bottomColor: string): this {
        this._bottomColor = bottomColor
        return this
    }
    public leftBorderType(leftBorderType: StBorderStyle): this {
        this._leftBorderType = leftBorderType
        return this
    }
    public rightBorderType(rightBorderType: StBorderStyle): this {
        this._rightBorderType = rightBorderType
        return this
    }
    public topBorderType(topBorderType: StBorderStyle): this {
        this._topBorderType = topBorderType
        return this
    }
    public bottomBorderType(bottomBorderType: StBorderStyle): this {
        this._bottomBorderType = bottomBorderType
        return this
    }
    public outline(outline: boolean): this {
        this._outline = outline
        return this
    }
    public diagonalUp(diagonalUp: boolean): this {
        this._diagonalUp = diagonalUp
        return this
    }
    public diagonalDown(diagonalDown: boolean): this {
        this._diagonalDown = diagonalDown
        return this
    }
    public build(): SetBorder {
        if (this._sheetIdx === undefined) throw Error('sheetIdx is undefined')
        if (this._row === undefined) throw Error('row is undefined!')
        if (this._col === undefined) throw Error('col is undefined!')
        return {
            type: 'setBorder',
            sheetIdx: this._sheetIdx,
            row: this._row,
            col: this._col,
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
