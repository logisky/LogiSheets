import {StandardFont} from 'core/standable'
import {
    Alignment,
    Alignment_Horizontal,
    Alignment_Vertical,
    Font,
    ReadingOrder,
} from 'proto/message'

export class TextAttr {
    setFont(font?: StandardFont | Font) {
        if (font === undefined)
            return
        this.font = font instanceof StandardFont ? font : StandardFont.from(font)
    }
    font = new StandardFont()
    alignment: Alignment | undefined = {
        horizontal: Alignment_Horizontal.H_CENTER,
        vertical: Alignment_Vertical.V_CENTER,
        indent: 0,
        justifyLastLine: false,
        readingOrder: ReadingOrder.UNRECOGNIZED,
        relativeIndent: 0,
        shrinkToFit: false,
        textRotation: 0,
        wrapText: false,
    }
}
