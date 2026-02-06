import {StandardFont} from '@/core/standable'
import {Alignment, Font} from 'logisheets-engine'

export class TextAttr {
    setFont(font?: StandardFont | Font) {
        if (font === undefined) return
        this.font =
            font instanceof StandardFont ? font : StandardFont.from(font)
    }
    font = new StandardFont()
    alignment: Alignment | undefined = {
        horizontal: 'center',
        vertical: 'center',
        wrapText: false,
    }
}
