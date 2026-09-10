import {VerticalAlignment, HorizontalAlignment} from 'logisheets-engine'
import {Range} from '@/core/standable'
export class Box {
    public position = new Range()
    public get width() {
        return this.position.width
    }

    public get height() {
        return this.position.height
    }

    setPosition(position: Range) {
        this.position = position
        return this
    }

    public textX(
        align?: HorizontalAlignment | null
    ): readonly [tx: number, textAlign: CanvasTextAlign] {
        let tx: number
        let textAlign: CanvasTextAlign
        const {startCol: x} = this.position
        // set default to center
        const alignX = align ?? 'center'
        switch (alignX) {
            // general / centre
            case 'general':
            case 'center':
                textAlign = 'center'
                tx = x + this.width / 2
                break
            // left (indented)
            case 'left':
                textAlign = 'left'
                tx = x
                break
            // right (indented)
            case 'right':
                textAlign = 'right'
                tx = x + this.width
                break
            // // fill
            // case AlignX.H_FILL:
            //     return box.x
            // // centre across columns
            // case AlignX.H_CENTER_CONTINUOUS:
            //     return 'center'
            // // justify
            // case AlignX.H_JUSTIFY:
            //     return 'center'
            // // distributed (indented)
            // case AlignX.H_DISTRIBUTED:
            //     return 'center'
            default:
                // tslint:disable-next-line: no-throw-unless-asserts
                throw Error(`Not support type ${align}`)
        }
        return [tx, textAlign]
    }

    public textY(
        vertical?: VerticalAlignment | null
    ): readonly [number, CanvasTextBaseline] {
        let ty: number
        let textBaseline: CanvasTextBaseline
        const {startRow: y} = this.position
        // set default to center
        const alignY = vertical ?? 'center'
        switch (alignY) {
            // top
            case 'top':
                textBaseline = 'top'
                ty = y
                break
            // default
            // centre
            case 'center':
                textBaseline = 'middle'
                ty = y + this.height / 2
                break
            // bottom
            case 'bottom':
                textBaseline = 'bottom'
                ty = y + this.height
                break
            // // distributed
            // case AlignY.V_DISTRIBUTED:
            //     return 'bottom'
            // // justify
            // case AlignY.V_JUSTIFY:
            //     return 'bottom'
            default:
                // tslint:disable-next-line: no-throw-unless-asserts
                throw Error(`Not support type ${vertical}`)
        }
        return [ty, textBaseline]
    }
}
