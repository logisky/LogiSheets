import {Style, StyleImpl} from '@logi-pb/network/src/proto/message_pb'
import {shallowCopy} from '@logi-sheets/web/global'
import {StandardFont} from './font'

export class StandardStyle extends StyleImpl {
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
