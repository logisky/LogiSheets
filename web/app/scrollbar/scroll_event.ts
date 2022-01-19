import {Builder} from '@logi-base/src/ts/common/builder'
import {ScrollbarType} from './scrollbar'
export interface ScrollEvent {
    readonly type: ScrollbarType
    readonly delta: number
    readonly scrollDistance: number
    readonly trust: boolean
}

class ScrollEventImpl implements ScrollEvent {
    public type!: ScrollbarType
    public delta = 0
    public scrollDistance = 0
    public trust = false
}

export class ScrollEventBuilder extends Builder<ScrollEvent, ScrollEventImpl> {
    public constructor(obj?: Readonly<ScrollEvent>) {
        const impl = new ScrollEventImpl()
        if (obj)
            ScrollEventBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public type(type: ScrollbarType): this {
        this.getImpl().type = type
        return this
    }

    public delta(delta: number): this {
        this.getImpl().delta = delta
        return this
    }

    public trust(trust: boolean): this {
        this.getImpl().trust = trust
        return this
    }

    public scrollDistance(scrollDistance: number): this {
        this.getImpl().scrollDistance = scrollDistance
        return this
    }

    protected get daa(): readonly string[] {
        return ScrollEventBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'type',
    ]
}

export function isScrollEvent(value: unknown): value is ScrollEvent {
    return value instanceof ScrollEventImpl
}

export function assertIsScrollEvent(
    value: unknown
): asserts value is ScrollEvent {
    if (!(value instanceof ScrollEventImpl))
        throw Error('Not a ScrollEvent!')
}
