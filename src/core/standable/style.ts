import { CtCellAlignment, Border, Font, Fill, Style, CtCellProtection } from 'bindings'
import { shallowCopy } from 'common'
import { StandardFont } from './font'

export class StandardStyle implements Style {
    protection!: CtCellProtection 
    border!: Border
    font!: Font 
    fill!: Fill
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
