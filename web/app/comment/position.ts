import {Builder} from '@logi-base/src/ts/common/builder'
export interface Position {
    readonly x: number
    readonly y: number
}

class PositionImpl implements Position {
    public x!: number
    public y!: number
}

export class PositionBuilder extends Builder<Position, PositionImpl> {
    public constructor(obj?: Readonly<Position>) {
        const impl = new PositionImpl()
        if (obj)
            PositionBuilder.shallowCopy(impl, obj)
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

    protected get daa(): readonly string[] {
        return PositionBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'x',
        'y',
    ]
}

export function isPosition(value: unknown): value is Position {
    return value instanceof PositionImpl
}

export function assertIsPosition(value: unknown): asserts value is Position {
    if (!(value instanceof PositionImpl))
        throw Error('Not a Position!')
}
