import {
    StVerticalAlignment as AlignY,
    StHorizontalAlignment as AlignX,
} from '@/bindings'
import {Range} from '@/core/standable'
export class Box {
    public position = new Range()
    public get width() {
        return this.position.width
    }

    public get height() {
        return this.position.height
    }

    public textX(
        align?: AlignX | null
    ): readonly [tx: number, textAlign: CanvasTextAlign] {
        let tx: number
        let textAlign: CanvasTextAlign
        const {startCol: x} = this.position
        // set default to center
        const alignX = align ?? 'center'
        switch (alignX) {
            // default
            // 常规
            // 居中
            case 'general':
            case 'center':
                textAlign = 'center'
                tx = x + this.width / 2
                break
            // 靠左(缩进)
            case 'left':
                textAlign = 'left'
                tx = x
                break
            // 靠右(缩进)
            case 'right':
                textAlign = 'right'
                tx = x + this.width
                break
            // // 填充
            // case AlignX.H_FILL:
            //     return box.x
            // // 跨列居中
            // case AlignX.H_CENTER_CONTINUOUS:
            //     return 'center'
            // // 两端对齐
            // case AlignX.H_JUSTIFY:
            //     return 'center'
            // // 分散对齐(缩进)
            // case AlignX.H_DISTRIBUTED:
            //     return 'center'
            default:
                // tslint:disable-next-line: no-throw-unless-asserts
                throw Error(`Not support type ${align}`)
        }
        return [tx, textAlign]
    }

    public textY(
        vertical?: AlignY | null
    ): readonly [number, CanvasTextBaseline] {
        let ty: number
        let textBaseline: CanvasTextBaseline
        const {startRow: y} = this.position
        // set default to center
        const alignY = vertical ?? 'Center'
        switch (alignY) {
            // 靠上
            case 'top':
                textBaseline = 'top'
                ty = y
                break
            // default
            // 居中
            case 'center':
                textBaseline = 'middle'
                ty = y + this.height / 2
                break
            // 靠下
            case 'bottom':
                textBaseline = 'bottom'
                ty = y + this.height
                break
            // // 分散对齐
            // case AlignY.V_DISTRIBUTED:
            //     return 'bottom'
            // // 两端对齐
            // case AlignY.V_JUSTIFY:
            //     return 'bottom'
            default:
                // tslint:disable-next-line: no-throw-unless-asserts
                throw Error(`Not support type ${vertical}`)
        }
        return [ty, textBaseline]
    }
}
