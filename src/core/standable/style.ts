import { Alignment, Border, Font, PatternFill, Style } from 'proto/message'
import { shallowCopy } from 'common'
import { StandardFont } from './font'

export class StandardStyle implements Style {
    border: Border | undefined = undefined
    font: Font | undefined = undefined
    fill: PatternFill | undefined = undefined
    alignment: Alignment | undefined = undefined
    formatter: string = ''
    static from(style: Style) {
        const s = new StandardStyle()
        shallowCopy(style, s)
        return s
    }

    getFont() {
        if (!this.font)
            return new StandardFont()
        return StandardFont.from(this.font)
    }
}
