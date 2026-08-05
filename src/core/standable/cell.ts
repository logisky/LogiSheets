import {StandardValue} from './value'
import {StandardStyle} from './style'

export class StandardCell {
    style?: StandardStyle
    value?: StandardValue
    formula = ''
    diyCellId?: number
    blockId?: number
    setStyle(style?: StandardStyle) {
        this.style = style
    }

    // Number-format rendering now lives in the engine worker (native ssf-rs via
    // WASM); this main-thread helper only does plain stringification.
    getFormattedText() {
        const num = this.getNumber()
        if (num !== undefined) return String(num)
        return this.getText()
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
