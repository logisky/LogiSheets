import {Builder} from '@logi-base/src/ts/common/builder'
import {Impl} from '@logi-base/src/ts/common/mapped_types'
export interface BaseInfo {
    readonly x: number
    readonly y: number
    readonly lineNumber: number
    readonly column: number
    equal(baseInfo: BaseInfo): boolean
    biggerThan(baseInfo: BaseInfo): boolean
}

class BaseInfoImpl implements BaseInfo {
    public x = 0
    public y = 0
    public lineNumber = 0
    public column = 0
    equal(baseInfo: BaseInfo): boolean {
        return baseInfo.x === this.x
            && baseInfo.y === this.y
            && baseInfo.lineNumber === this.lineNumber
            && baseInfo.column === this.column
    }

    biggerThan(baseInfo: BaseInfo): boolean {
        if (this.y > baseInfo.y)
            return true
        if (this.y === baseInfo.y && this.x > baseInfo.x)
            return true
        return false
    }
}

// tslint:disable-next-line: ext-variable-name naming-convention
class _BaseInfoBuilder<T extends BaseInfoImpl, S extends Impl<T>> extends Builder<T, S> {
    public x(x: number): this {
        this.getImpl().x = x
        return this
    }

    public y(y: number): this {
        this.getImpl().y = y
        return this
    }

    public lineNumber(lineNumber: number): this {
        this.getImpl().lineNumber = lineNumber
        return this
    }

    public column(column: number): this {
        this.getImpl().column = column
        return this
    }
}
export class BaseInfoBuilder extends _BaseInfoBuilder<BaseInfo, BaseInfoImpl> {
    public constructor(obj?: Readonly<BaseInfo>) {
        const impl = new BaseInfoImpl()
        if (obj)
            BaseInfoBuilder.shallowCopy(impl, obj)
        super(impl)
    }

}

export function isBaseInfo(value: unknown): value is BaseInfo {
    return value instanceof BaseInfoImpl
}

export function assertIsBaseInfo(value: unknown): asserts value is BaseInfo {
    if (!(value instanceof BaseInfoImpl))
        throw Error('Not a BaseInfo!')
}

export interface CursorInfo extends BaseInfo {
    readonly height: number
    updateFromBaseInfo(baseInfo: BaseInfo): void
}

class CursorInfoImpl extends BaseInfoImpl implements CursorInfo {
    public height = 0
    updateFromBaseInfo(baseInfo: BaseInfo): void {
        this.x = baseInfo.x
        this.y = baseInfo.y
        this.lineNumber = baseInfo.lineNumber
        this.column = baseInfo.column
    }
}

export class CursorInfoBuilder extends _BaseInfoBuilder<CursorInfo, CursorInfoImpl> {
    public constructor(obj?: Readonly<CursorInfo>) {
        const impl = new CursorInfoImpl()
        if (obj)
            CursorInfoBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public height(height: number): this {
        this.getImpl().height = height
        return this
    }
}

export function isCursorInfo(value: unknown): value is CursorInfo {
    return value instanceof CursorInfoImpl
}

export function assertIsCursorInfo(
    value: unknown
): asserts value is CursorInfo {
    if (!(value instanceof CursorInfoImpl))
        throw Error('Not a CursorInfo!')
}
