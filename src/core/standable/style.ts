import {
    CtCellAlignment,
    Border,
    Font,
    Fill,
    Style,
    CtCellProtection,
} from '@logisheets_bg'
import {shallowCopy} from '@/core'
import {StandardFont} from './font'

export class StandardStyle implements Style {
    protection!: CtCellProtection
    border!: Border
    font!: Font
    fill!: Fill
    alignment!: CtCellAlignment
    formatter = ''
    static from(style: Style) {
        const s = new StandardStyle()
        shallowCopy(style, s)
        return s
    }

    getFont() {
        if (!this.font) return new StandardFont()
        return StandardFont.from(this.font)
    }
}
