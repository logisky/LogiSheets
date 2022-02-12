const ALPHA = 255
// https://en.wikipedia.org/wiki/RGBA_color_model
export class StandardColor {
    /**
     * standard argb format. Example: FF000000
     */
    static fromArgb(argb: string): StandardColor {
        const color = new StandardColor()
        if (argb === '')
            return color
        color._alpha = parseInt(argb.slice(0,2), 16)
        color._red = parseInt(argb.slice(2,4), 16)
        color._green = parseInt(argb.slice(4,6), 16)
        color._blue = parseInt(argb.slice(6,8), 16)
        return color
    }

    /**
     * @param r decimal
     * @param g decimal
     * @param b decimal
     * @param a percentage
     */
    // tslint:disable-next-line: max-params
    static from(r: number, g: number, b: number, a = 1): StandardColor {
        const color = new StandardColor()
        color._red = r
        color._green = g
        color._blue = b
        color._alpha = ALPHA * a
        return color
    }

    css(): string {
        const alpha = this._alpha / ALPHA
        if (!this._valid())
            return 'transparent'
        return `rgba(${this._red}, ${this._green}, ${this._blue}, ${alpha})`
    }

    argb(): string {
        if (!this._valid())
            return ''
        const transfer = (num: number) => num.toString(16).padStart(2, '0')
        const a = transfer(this._alpha)
        const r = transfer(this._red ?? 0)
        const g = transfer(this._green ?? 0)
        const b = transfer(this._blue ?? 0)
        return `${a}${r}${g}${b}`
    }
    private _red?: number
    private _green?: number
    private _blue?: number
    private _alpha = ALPHA
    private _valid(): boolean {
        return this._red !== undefined
            && this._green !== undefined
            && this._blue !== undefined
    }
}
