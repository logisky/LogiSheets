import { Style } from '@/bindings'
import { StandardValue } from './value'
import { format } from 'ssf'
import { StandardStyle } from './style'
import { Extract } from '@/core/html'

export class StandardCell {
    style?: StandardStyle
    value?: StandardValue
    formula = ''
    setStyle (style?: Style) {
        if (!style) {
            this.style = undefined
            return
        }
        this.style = StandardStyle.from(style)
    }

    getFormattedText () {
        const v = this.getText()
        const formatter = this.style?.formatter ?? ''
        return format(Extract(formatter), v)
    }

    getText () {
        return this.value?.valueStr ?? ''
    }

    getFormular () {
        return `=${this.formula}`
    }
}
