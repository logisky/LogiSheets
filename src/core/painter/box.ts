import {
    Alignment_Horizontal as AlignX,
    Alignment_Vertical as AlignY,
} from 'proto/message'
import { Range } from 'core/standable'
export class Box {
    public position = new Range()
    public get width() {
        return this.position.endCol - this.position.startCol
    }

    public get height() {
        return this.position.endRow - this.position.startRow
    }

    public textX(
        align?: AlignX
    ): readonly [tx: number, textAlign: CanvasTextAlign] {
        let tx: number
        let textAlign: CanvasTextAlign
        const { startCol: x } = this.position
        // set default to center
        const alignX = align ?? AlignX.H_CENTER
        switch (alignX) {
            // default
            // 常规
            // 居中
            case AlignX.H_UNSPECIFIED:
            case AlignX.H_GENERAL:
            case AlignX.H_CENTER:
                textAlign = 'center'
                tx = x + this.width / 2
                break
            // 靠左(缩进)
            case AlignX.H_LEFT:
                textAlign = 'left'
                tx = x
                break
            // 靠右(缩进)
            case AlignX.H_RIGHT:
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

    public textY(vertical?: AlignY): readonly [number, CanvasTextBaseline] {
        let ty: number
        let textBaseline: CanvasTextBaseline
        const { startRow: y } = this.position
        // set default to center
        const alignY = vertical ?? AlignY.V_CENTER
        switch (alignY) {
            // 靠上
            case AlignY.V_TOP:
                textBaseline = 'top'
                ty = y
                break
            // default
            // 居中
            case AlignY.V_UNSPECIFIED:
            case AlignY.V_CENTER:
                textBaseline = 'middle'
                ty = y + this.height / 2
                break
            // 靠下
            case AlignY.V_BOTTOM:
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
