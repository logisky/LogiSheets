import {
    Alignment_HorizontalEnum as AlignX,
    Alignment_VerticalEnum as AlignY,
} from '@logi-pb/network/src/proto/message_pb'
import {Builder} from '@logi-base/src/ts/common/builder'
import {RangeBuilder, Range} from '@logi-sheets/web/core/standable'
export interface Box {
    readonly position: Range
    readonly width: number
    readonly height: number
    textX(align: AlignX): readonly [number, CanvasTextAlign]
    textY(vertical: AlignY): readonly [number, CanvasTextBaseline]
}

class BoxImpl implements Box {
    public position = new RangeBuilder().build()
    public get width() {
        return this.position.endCol - this.position.startCol
    }

    public get height() {
        return this.position.endRow - this.position.startRow
    }

    public textX(
        align: AlignX
    ): readonly [tx: number, textAlign: CanvasTextAlign] {
        let tx: number
        let textAlign: CanvasTextAlign
        const {startCol: x} = this.position
        switch(align) {
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

    public textY(vertical: AlignY): readonly [number, CanvasTextBaseline] {
        let ty: number
        let textBaseline: CanvasTextBaseline
        const {startRow: y} = this.position
        switch(vertical) {
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

export class BoxBuilder extends Builder<Box, BoxImpl> {
    public constructor(obj?: Readonly<Box>) {
        const impl = new BoxImpl()
        if (obj)
            BoxBuilder.shallowCopy(impl, obj)
        super(impl)
    }
    public position(position: Range): this {
        this.getImpl().position = position
        return this
    }

    protected get daa(): readonly string[] {
        return BoxBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'position',
    ]
}

export function isBox(value: unknown): value is Box {
    return value instanceof BoxImpl
}

export function assertIsBox(value: unknown): asserts value is Box {
    if (!(value instanceof BoxImpl))
        throw Error('Not a Box!')
}
