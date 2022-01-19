import {Builder} from '@logi-base/src/ts/common/builder'
export interface CompositionData {
    readonly data: string
}

class CompositionDataImpl implements CompositionData {
    public data!: string
}

export class CompositionDataBuilder extends Builder<CompositionData, CompositionDataImpl> {
    public constructor(obj?: Readonly<CompositionData>) {
        const impl = new CompositionDataImpl()
        if (obj)
            CompositionDataBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public data(data: string): this {
        this.getImpl().data = data
        return this
    }

    protected get daa(): readonly string[] {
        return CompositionDataBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'data',
    ]
}

export function isCompositionData(value: unknown): value is CompositionData {
    return value instanceof CompositionDataImpl
}

export function assertIsCompositionData(
    value: unknown
): asserts value is CompositionData {
    if (!(value instanceof CompositionDataImpl))
        throw Error('Not a CompositionData!')
}

export interface CompositionStartEvent {
    readonly revealDeltaColumns: number
}

class CompositionStartEventImpl implements CompositionStartEvent {
    public revealDeltaColumns!: number
}

export class CompositionStartEventBuilder extends Builder<CompositionStartEvent, CompositionStartEventImpl> {
    public constructor(obj?: Readonly<CompositionStartEvent>) {
        const impl = new CompositionStartEventImpl()
        if (obj)
            CompositionStartEventBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public revealDeltaColumns(revealDeltaColumns: number): this {
        this.getImpl().revealDeltaColumns = revealDeltaColumns
        return this
    }

    protected get daa(): readonly string[] {
        return CompositionStartEventBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'revealDeltaColumns',
    ]
}

export function isCompositionStartEvent(
    value: unknown
): value is CompositionStartEvent {
    return value instanceof CompositionStartEventImpl
}

export function assertIsCompositionStartEvent(
    value: unknown
): asserts value is CompositionStartEvent {
    if (!(value instanceof CompositionStartEventImpl))
        throw Error('Not a CompositionStartEvent!')
}
