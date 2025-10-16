import {StandardValue} from './value'
import {format} from 'ssf'
import {StandardStyle} from './style'
import {extract} from '@/core/html'

export class StandardCell {
    style?: StandardStyle
    value?: StandardValue
    formula = ''
    diyCellId?: number
    blockId?: number
    setStyle(style?: StandardStyle) {
        this.style = style
    }

    getFormattedText() {
        const num = this.getNumber()
        if (num !== undefined)
            return format(extract(this.style?.formatter ?? ''), num)
        const v = this.getText()
        const formatter = this.style?.formatter ?? ''
        return format(extract(formatter), v)
    }

    getText() {
        return this.value?.valueStr ?? ''
    }

    getNumber(): number | undefined {
        if (this.value?.cellValueOneof?.$case === 'number')
            return this.value?.cellValueOneof.number
        return undefined
    }

    getFormular() {
        return `=${this.formula}`
    }
}
