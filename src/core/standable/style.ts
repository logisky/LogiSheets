import { CtCellAlignment, CtBorder, CtFont, CtFill, Style, CtCellProtection } from 'bindings'
import { shallowCopy } from 'common'
import { StandardFont } from './font'

export class StandardStyle implements Style {
    protection!: CtCellProtection 
    border!: CtBorder
    font!: CtFont 
    fill!: CtFill
    alignment!: CtCellAlignment
    formatter: string = ''
    static from (style: Style) {
        const s = new StandardStyle()
        shallowCopy(style, s)
        return s
    }

    getFont () {
        if (!this.font)
            return new StandardFont()
        return StandardFont.from(this.font)
    }
}
