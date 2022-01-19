import {Builder} from '@logi-base/src/ts/common/builder'

export interface ScrollPosition {
    /**
     * pixel of x-axis margin-left
     */
    readonly x: number
    /**
     * pixel of y-axis magin-top
     */
    readonly y: number
}

class ScrollPositionImpl implements ScrollPosition {
    public x = 0
    public y = 0
}

export class ScrollPositionBuilder extends Builder<ScrollPosition, ScrollPositionImpl> {
    public constructor(obj?: Readonly<ScrollPosition>) {
        const impl = new ScrollPositionImpl()
        if (obj)
            ScrollPositionBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public x(x: number): this {
        this.getImpl().x = x
        return this
    }

    public y(y: number): this {
        this.getImpl().y = y
        return this
    }
}

export function isScrollPosition(value: unknown): value is ScrollPosition {
    return value instanceof ScrollPositionImpl
}

export function assertIsScrollPosition(
    value: unknown
): asserts value is ScrollPosition {
    if (!(value instanceof ScrollPositionImpl))
        throw Error('Not a ScrollPosition!')
}
