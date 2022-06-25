import {StandardFont} from '@/core/standable'
import {CtCellAlignment, CtFont} from '@/bindings'

export class TextAttr {
    setFont(font?: StandardFont | CtFont) {
        if (font === undefined)
            return
        this.font = font instanceof StandardFont ? font : StandardFont.from(font)
    }
    font = new StandardFont()
    alignment: CtCellAlignment | undefined = {
        horizontal: "Center",
        vertical: "Center",
        indent: 0,
        justifyLastLine: false,
        readingOrder: -1,
        relativeIndent: 0,
        shrinkToFit: false,
        textRotation: 0,
        wrapText: false,
    }
}
