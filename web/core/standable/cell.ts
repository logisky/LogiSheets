import {Style, Value} from '@logi-pb/network/src/proto/message_pb'
// @ts-expect-error no .d.ts
import * as numfmt from 'numfmt'
import {StandardStyle} from './style'

export class StandardCell {
    style?: StandardStyle
    value?: Value
    formula = ''
    setStyle(style?: Style) {
        if (!style) {
            this.style = undefined
            return
        }
        this.style = StandardStyle.from(style)
    }

    getFormattedText() {
        const v = this.getText()
        const formatter = this.style?.formatter ?? ''
        return numfmt.format(formatter, v)
    }

    getText() {
        return this.value?.getCellValueOneof()?.[0].toString() ?? ''
    }

    getFormular() {
        return `=${this.formula}`
    }
}
