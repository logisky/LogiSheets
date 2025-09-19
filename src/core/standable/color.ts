import {Color} from 'logisheets-web'
const ALPHA = 255
// https://en.wikipedia.org/wiki/RGBA_color_model
export class StandardColor {
    static fromRgb(rgb: string) {
        const color = new StandardColor()
        if (rgb === '') return color
        color.#red = parseInt(rgb.slice(0, 2), 16)
        color.#green = parseInt(rgb.slice(2, 4), 16)
        color.#blue = parseInt(rgb.slice(4, 6), 16)
        return color
    }
    static fromCtColor(color?: Color) {
        if (color === undefined) {
            return new StandardColor()
        }
        const result = new StandardColor()
        result.#red = color.red
        result.#green = color.green
        result.#blue = color.blue
        if (color.alpha) result.#alpha = color.alpha
        return result
    }

    /**
     * standard argb format. Example: FF000000
     */
    static fromArgb(argb: string) {
        const color = new StandardColor()
        if (argb === '') return color
        color.#alpha = parseInt(argb.slice(0, 2), 16)
        color.#red = parseInt(argb.slice(2, 4), 16)
        color.#green = parseInt(argb.slice(4, 6), 16)
        color.#blue = parseInt(argb.slice(6, 8), 16)
        return color
    }

    /**
     * @param r decimal
     * @param g decimal
     * @param b decimal
     * @param a percentage
     */
    // tslint:disable-next-line: max-params
    static from(r: number, g: number, b: number, a = 1) {
        const color = new StandardColor()
        color.#red = r
        color.#green = g
        color.#blue = b
        color.#alpha = ALPHA * a
        return color
    }
    equal(c: StandardColor, exceptAlpha = false) {
        return exceptAlpha ? c.rgb() === this.rgb() : c.argb() === this.argb()
    }

    css() {
        const alpha = this.#alpha / ALPHA
        if (!this._valid()) return 'transparent'
        return `rgba(${this.#red}, ${this.#green}, ${this.#blue}, ${alpha})`
    }
    rgb() {
        if (!this._valid()) return ''
        const transfer = (num: number) => num.toString(16).padStart(2, '0')
        const r = transfer(this.#red ?? 0)
        const g = transfer(this.#green ?? 0)
        const b = transfer(this.#blue ?? 0)
        return `${r}${g}${b}`
    }

    argb() {
        if (!this._valid()) return ''
        const transfer = (num: number) => num.toString(16).padStart(2, '0')
        const a = transfer(this.#alpha)
        const r = transfer(this.#red ?? 0)
        const g = transfer(this.#green ?? 0)
        const b = transfer(this.#blue ?? 0)
        return `${a}${r}${g}${b}`
    }

    setAlpha(alpha: number) {
        this.#alpha = alpha
    }
    #red?: number
    #green?: number
    #blue?: number
    #alpha = ALPHA
    private _valid() {
        return (
            this.#red !== undefined &&
            this.#green !== undefined &&
            this.#blue !== undefined
        )
    }
}
