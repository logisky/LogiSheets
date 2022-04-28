import {CtColor} from 'bindings'
// https://css-tricks.com/snippets/javascript/random-hex-color/
function getRandomColor() {
    return Math.floor(Math.random()*16777215).toString(16);
}
const ALPHA = 255
// https://en.wikipedia.org/wiki/RGBA_color_model
export class StandardColor {
    static randomColor(excludes: StandardColor[] = []) {
        let color = getRandomColor()
        const exists = (c: string) => {
            return excludes.find(e => e.rgb() === c)
        }
        while (exists(color))
            color = getRandomColor()
        return StandardColor.fromRgb(color)
    }
    static fromRgb(rgb: string) {
        const color = new StandardColor()
        if (rgb === '')
            return color
        color.#red = parseInt(rgb.slice(0,2), 16)
        color.#green = parseInt(rgb.slice(2,4), 16)
        color.#blue = parseInt(rgb.slice(4,6), 16)
        return color
    }
    static fromCtColor(color: CtColor | null) {
        if (color === null) {
            return new StandardColor()
        }
        if (color.rgb !== null) {
            return  StandardColor.fromArgb(color.rgb)
        }
        if (color.indexed !== null) {
            switch (color.indexed) {
            case 0: return StandardColor.fromArgb("00000000")
            case 1: return StandardColor.fromArgb("00FFFFFF")
            case 2: return StandardColor.fromArgb("00FF0000")
            case 3: return StandardColor.fromArgb("0000FF00")
            case 4: return StandardColor.fromArgb("000000FF")
            case 5: return StandardColor.fromArgb("00FFFF00")
            case 6: return StandardColor.fromArgb("00FF00FF")
            case 7: return StandardColor.fromArgb("0000FFFF")
            case 8: return StandardColor.fromArgb("00000000")
            case 9: return StandardColor.fromArgb("00FFFFFF")
            case 10: return StandardColor.fromArgb("00FF0000")
            case 11: return StandardColor.fromArgb("0000FF00")
            case 12: return StandardColor.fromArgb("000000FF")
            case 13: return StandardColor.fromArgb("00FFFF00")
            case 14: return StandardColor.fromArgb("00FF00FF")
            case 15: return StandardColor.fromArgb("0000FFFF")
            case 16: return StandardColor.fromArgb("00800000")
            case 17: return StandardColor.fromArgb("00008000")
            case 18: return StandardColor.fromArgb("00000080")
            case 19: return StandardColor.fromArgb("00808000")
            case 20: return StandardColor.fromArgb("00800080")
            case 21: return StandardColor.fromArgb("00008080")
            case 22: return StandardColor.fromArgb("00C0C0C0")
            case 23: return StandardColor.fromArgb("00808080")
            case 24: return StandardColor.fromArgb("009999FF")
            case 25: return StandardColor.fromArgb("00993366")
            case 26: return StandardColor.fromArgb("00FFFFCC")
            case 27: return StandardColor.fromArgb("00CCFFFF")
            case 28: return StandardColor.fromArgb("00660066")
            case 29: return StandardColor.fromArgb("00FF8080")
            case 30: return StandardColor.fromArgb("000066CC")
            case 31: return StandardColor.fromArgb("00CCCCFF")
            case 32: return StandardColor.fromArgb("00000080")
            case 33: return StandardColor.fromArgb("00FF00FF")
            case 34: return StandardColor.fromArgb("00FFFF00")
            case 35: return StandardColor.fromArgb("0000FFFF")
            case 36: return StandardColor.fromArgb("00800080")
            case 37: return StandardColor.fromArgb("00800000")
            case 38: return StandardColor.fromArgb("00008080")
            case 39: return StandardColor.fromArgb("000000FF")
            case 40: return StandardColor.fromArgb("0000CCFF")
            case 41: return StandardColor.fromArgb("00CCFFFF")
            case 42: return StandardColor.fromArgb("00CCFFCC")
            case 43: return StandardColor.fromArgb("00FFFF99")
            case 44: return StandardColor.fromArgb("0099CCFF")
            case 45: return StandardColor.fromArgb("00FF99CC")
            case 46: return StandardColor.fromArgb("00CC99FF")
            case 47: return StandardColor.fromArgb("00FFCC99")
            case 48: return StandardColor.fromArgb("003366FF")
            case 49: return StandardColor.fromArgb("0033CCCC")
            case 50: return StandardColor.fromArgb("0099CC00")
            case 51: return StandardColor.fromArgb("00FFCC00")
            case 52: return StandardColor.fromArgb("00FF9900")
            case 53: return StandardColor.fromArgb("00FF6600")
            case 54: return StandardColor.fromArgb("00666699")
            case 55: return StandardColor.fromArgb("00969696")
            case 56: return StandardColor.fromArgb("00003366")
            case 57: return StandardColor.fromArgb("00339966")
            case 58: return StandardColor.fromArgb("00003300")
            case 59: return StandardColor.fromArgb("00333300")
            case 60: return StandardColor.fromArgb("00993300")
            case 61: return StandardColor.fromArgb("00993366")
            case 62: return StandardColor.fromArgb("00333399")
            case 63: return StandardColor.fromArgb("00333333")
            default: return new StandardColor()
            }
        }
        return new StandardColor()
    }

    /**
     * standard argb format. Example: FF000000
     */
    static fromArgb(argb: string) {
        const color = new StandardColor()
        if (argb === '')
            return color
        color.#alpha = parseInt(argb.slice(0,2), 16)
        color.#red = parseInt(argb.slice(2,4), 16)
        color.#green = parseInt(argb.slice(4,6), 16)
        color.#blue = parseInt(argb.slice(6,8), 16)
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
        if (!this._valid())
            return 'transparent'
        return `rgba(${this.#red}, ${this.#green}, ${this.#blue}, ${alpha})`
    }
    rgb() {
        if (!this._valid())
            return ''
        const transfer = (num: number) => num.toString(16).padStart(2, '0')
        const r = transfer(this.#red ?? 0)
        const g = transfer(this.#green ?? 0)
        const b = transfer(this.#blue ?? 0)
        return `${r}${g}${b}`
    }

    argb() {
        if (!this._valid())
            return ''
        const transfer = (num: number) => num.toString(16).padStart(2, '0')
        const a = transfer(this.#alpha)
        const r = transfer(this.#red ?? 0)
        const g = transfer(this.#green ?? 0)
        const b = transfer(this.#blue ?? 0)
        return `${a}${r}${g}${b}`
    }
    #red?: number
    #green?: number
    #blue?: number
    #alpha = ALPHA
    private _valid() {
        return this.#red !== undefined
            && this.#green !== undefined
            && this.#blue !== undefined
    }
}
