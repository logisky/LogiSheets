import {Builder} from '@logi-base/src/ts/common/builder'
export interface TypeData {
    readonly text: string
    readonly replacePrevCharCnt: number
    readonly replaceNextCharCnt: number
    readonly positionDelta: number
}

class TypeDataImpl implements TypeData {
    public text!: string
    public replacePrevCharCnt!: number
    public replaceNextCharCnt!: number
    public positionDelta = 0
}

export class TypeDataBuilder extends Builder<TypeData, TypeDataImpl> {
    public constructor(obj?: Readonly<TypeData>) {
        const impl = new TypeDataImpl()
        if (obj)
            TypeDataBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public text(text: string): this {
        this.getImpl().text = text
        return this
    }

    public replacePrevCharCnt(replacePrevCharCnt: number): this {
        this.getImpl().replacePrevCharCnt = replacePrevCharCnt
        return this
    }

    public replaceNextCharCnt(replaceNextCharCnt: number): this {
        this.getImpl().replaceNextCharCnt = replaceNextCharCnt
        return this
    }

    public positionDelta(positionDelta: number): this {
        this.getImpl().positionDelta = positionDelta
        return this
    }

    protected get daa(): readonly string[] {
        return TypeDataBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'text',
        'replacePrevCharCnt',
        'replaceNextCharCnt',
    ]
}

export function isTypeData(value: unknown): value is TypeData {
    return value instanceof TypeDataImpl
}

export function assertIsTypeData(value: unknown): asserts value is TypeData {
    if (!(value instanceof TypeDataImpl))
        throw Error('Not a TypeData!')
}
