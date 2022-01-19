import {Builder} from '@logi-base/src/ts/common/builder'
export interface Selector {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly borderRightWidth: number
    readonly borderLeftWidth: number
    readonly borderTopWidth: number
    readonly borderBottomWidth: number
    readonly editing: boolean
}

class SelectorImpl implements Selector {
    public x!: number
    public y!: number
    public width!: number
    public height!: number
    public borderRightWidth = 0
    public borderTopWidth = 0
    public borderBottomWidth = 0
    public borderLeftWidth = 0
    public editing = false
}

export class SelectorBuilder extends Builder<Selector, SelectorImpl> {
    public constructor(obj?: Readonly<Selector>) {
        const impl = new SelectorImpl()
        if (obj)
            SelectorBuilder.shallowCopy(impl, obj)
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

    public width(width: number): this {
        this.getImpl().width = width
        return this
    }

    public height(height: number): this {
        this.getImpl().height = height
        return this
    }

    public borderRightWidth(borderRightWidth: number): this {
        this.getImpl().borderRightWidth = borderRightWidth
        return this
    }

    public borderLeftWidth(borderLeftWidth: number): this {
        this.getImpl().borderLeftWidth = borderLeftWidth
        return this
    }

    public borderBottomWidth(borderBottomWidth: number): this {
        this.getImpl().borderBottomWidth = borderBottomWidth
        return this
    }

    public borderTopWidth(borderTopWidth: number): this {
        this.getImpl().borderTopWidth = borderTopWidth
        return this
    }

    public editing(editing: boolean): this {
        this.getImpl().editing = editing
        return this
    }

    protected get daa(): readonly string[] {
        return SelectorBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'x',
        'y',
        'width',
        'height',
    ]
}

export function isSelector(value: unknown): value is Selector {
    return value instanceof SelectorImpl
}

export function assertIsSelector(value: unknown): asserts value is Selector {
    if (!(value instanceof SelectorImpl))
        throw Error('Not a Selector!')
}
