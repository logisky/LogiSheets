import {Builder} from '@logi-base/src/ts/common/builder'
export interface BlurEvent {
    readonly text: string
    readonly bindingData: unknown
}

class BlurEventImpl implements BlurEvent {
    public text!: string
    public bindingData!: unknown
}

export class BlurEventBuilder extends Builder<BlurEvent, BlurEventImpl> {
    public constructor(obj?: Readonly<BlurEvent>) {
        const impl = new BlurEventImpl()
        if (obj)
            BlurEventBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public text(text: string): this {
        this.getImpl().text = text
        return this
    }

    public bindingData(bindingData: unknown): this {
        this.getImpl().bindingData = bindingData
        return this
    }

    protected get daa(): readonly string[] {
        return BlurEventBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'text',
        'bindingData',
    ]
}

export function isBlurEvent(value: unknown): value is BlurEvent {
    return value instanceof BlurEventImpl
}

export function assertIsBlurEvent(value: unknown): asserts value is BlurEvent {
    if (!(value instanceof BlurEventImpl))
        throw Error('Not a BlurEvent!')
}
