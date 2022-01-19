import {Builder} from '@logi-base/src/ts/common/builder'
import {StandardFont} from '@logi-sheets/web/core/standable'
export interface CanvasAttr {
    readonly direction?: CanvasDirection
    readonly fillStyle?: string
    readonly font?: StandardFont
    readonly lineWidth?: number
    readonly strokeStyle?: string
    readonly textAlign?: CanvasTextAlign
    readonly textBaseAlign?: CanvasTextBaseline
}

class CanvasAttrImpl implements CanvasAttr {
    public fillStyle?: string
    public strokeStyle?: string
    public direction?: CanvasDirection
    public lineWidth?: number
    public textAlign?: CanvasTextAlign
    public textBaseAlign?: CanvasTextBaseline
    public font?: StandardFont
}

export class CanvasAttrBuilder extends Builder<CanvasAttr, CanvasAttrImpl> {
    public constructor(obj?: Readonly<CanvasAttr>) {
        const impl = new CanvasAttrImpl()
        if (obj)
            CanvasAttrBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public fillStyle(fillStyle: string): this {
        this.getImpl().fillStyle = fillStyle
        return this
    }

    public strokeStyle(strokeStyle: string): this {
        this.getImpl().strokeStyle = strokeStyle
        return this
    }

    public direction(direction: CanvasDirection): this {
        this.getImpl().direction = direction
        return this
    }

    public lineWidth(lineWidth: number): this {
        this.getImpl().lineWidth = lineWidth
        return this
    }

    public textAlign(textAlign: CanvasTextAlign): this {
        this.getImpl().textAlign = textAlign
        return this
    }

    public textBaseAlign(textBaseAlign: CanvasTextBaseline): this {
        this.getImpl().textBaseAlign = textBaseAlign
        return this
    }

    public font(font: StandardFont): this {
        this.getImpl().font = font
        return this
    }
}

export function isCanvasAttr(value: unknown): value is CanvasAttr {
    return value instanceof CanvasAttrImpl
}

export function assertIsCanvasAttr(
    value: unknown
): asserts value is CanvasAttr {
    if (!(value instanceof CanvasAttrImpl))
        throw Error('Not a CanvasAttr!')
}
