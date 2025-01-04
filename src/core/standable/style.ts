import {
    CtCellAlignment,
    Border,
    Font,
    Fill,
    Style,
    CtCellProtection,
} from 'logisheets-web'
import {shallowCopy} from '@/core'
import {StandardFont} from './font'

export class StandardStyle implements Style {
    protection!: CtCellProtection
    border!: Border
    font!: Font
    fill!: Fill
    alignment!: CtCellAlignment
    formatter = ''
    from(style: Style) {
        shallowCopy(style, this)
        return this
    }

    getFont() {
        if (!this.font) return new StandardFont()
        return StandardFont.from(this.font)
    }
}
