import {Builder} from '@logi-base/src/ts/common/builder'
export type ScrollbarType = 'x' | 'y'
export interface ScrollbarAttr {
    readonly containerLength: number
    readonly scrollDistance: number
    readonly containerTotalLength: number
}

class ScrollbarAttrImpl implements ScrollbarAttr {
    public containerLength = 0
    public scrollDistance = 0
    public containerTotalLength = 0
}

export class ScrollbarAttrBuilder extends Builder<ScrollbarAttr, ScrollbarAttrImpl> {
    public constructor(obj?: Readonly<ScrollbarAttr>) {
        const impl = new ScrollbarAttrImpl()
        if (obj)
            ScrollbarAttrBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public containerLength(containerLength: number): this {
        this.getImpl().containerLength = containerLength
        return this
    }

    public scrollDistance(scrollDistance: number): this {
        this.getImpl().scrollDistance = scrollDistance
        return this
    }

    public containerTotalLength(containerTotalLength: number): this {
        this.getImpl().containerTotalLength = containerTotalLength
        return this
    }
}

export function isScrollbarAttr(value: unknown): value is ScrollbarAttr {
    return value instanceof ScrollbarAttrImpl
}

export function assertIsScrollbarAttr(
    value: unknown
): asserts value is ScrollbarAttr {
    if (!(value instanceof ScrollbarAttrImpl))
        throw Error('Not a ScrollbarAttr!')
}
