import {Builder} from '@logi-base/src/ts/common/builder'
export const enum ErrorNodeType {
    UNSPECIFIED,
    LEX,
}
export interface ErrorNode {
    readonly type: ErrorNodeType
    readonly msg: string
}

class ErrorNodeImpl implements ErrorNode {
    public type = ErrorNodeType.UNSPECIFIED
    public msg!: string
}

export class ErrorNodeBuilder extends Builder<ErrorNode, ErrorNodeImpl> {
    public constructor(obj?: Readonly<ErrorNode>) {
        const impl = new ErrorNodeImpl()
        if (obj)
            ErrorNodeBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public type(type: ErrorNodeType): this {
        this.getImpl().type = type
        return this
    }

    public msg(msg: string): this {
        this.getImpl().msg = msg
        return this
    }

    protected get daa(): readonly string[] {
        return ErrorNodeBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'type',
        'msg',
    ]
}

export function isErrorNode(value: unknown): value is ErrorNode {
    return value instanceof ErrorNodeImpl
}

export function assertIsErrorNode(value: unknown): asserts value is ErrorNode {
    if (!(value instanceof ErrorNodeImpl))
        throw Error('Not a ErrorNode!')
}
