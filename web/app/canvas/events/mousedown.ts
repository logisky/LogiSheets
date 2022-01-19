import {Builder} from '@logi-base/src/ts/common/builder'
export const enum MouseDownType {
    UNKNOWN = 'unknown',
    FORMULA = 'formula',
    TEXT = 'text',
}
export interface MouseDownEvent {
    readonly type: MouseDownType
    readonly cellText: string
}

class MouseDownEventImpl implements MouseDownEvent {
    public type = MouseDownType.UNKNOWN
    public cellText = ''
}

export class MouseDownEventBuilder extends Builder<MouseDownEvent, MouseDownEventImpl> {
    public constructor(obj?: Readonly<MouseDownEvent>) {
        const impl = new MouseDownEventImpl()
        if (obj)
            MouseDownEventBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public cellText(cellText: string): this {
        this.getImpl().cellText = cellText
        return this
    }

    public type(type: MouseDownType): this {
        this.getImpl().type = type
        return this
    }

    protected get daa(): readonly string[] {
        return MouseDownEventBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'cellText',
        'type',
    ]
}

export function isMouseDownEvent(value: unknown): value is MouseDownEvent {
    return value instanceof MouseDownEventImpl
}

export function assertIsMouseDownEvent(
    value: unknown
): asserts value is MouseDownEvent {
    if (!(value instanceof MouseDownEventImpl))
        throw Error('Not a MouseDownEvent!')
}
