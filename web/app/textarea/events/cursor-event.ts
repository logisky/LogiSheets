import {Builder} from '@logi-base/src/ts/common/builder'
export interface CursorEvent {
    readonly offsetX: number
    readonly offsetY: number
    readonly clientX: number
    readonly clientY: number
    readonly show: boolean
    readonly lineNumber: number
    readonly columnNumber: number
}

class CursorEventImpl implements CursorEvent {
    public offsetX = 0
    public offsetY = 0
    public clientX = 0
    public clientY = 0
    public show = false
    public lineNumber = 0
    public columnNumber = 0
}

export class CursorEventBuilder extends Builder<CursorEvent, CursorEventImpl> {
    public constructor(obj?: Readonly<CursorEvent>) {
        const impl = new CursorEventImpl()
        if (obj)
            CursorEventBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public offsetX(offsetX: number): this {
        this.getImpl().offsetX = offsetX
        return this
    }

    public offsetY(offsetY: number): this {
        this.getImpl().offsetY = offsetY
        return this
    }

    public clientX(clientX: number): this {
        this.getImpl().clientX = clientX
        return this
    }

    public clientY(clientY: number): this {
        this.getImpl().clientY = clientY
        return this
    }

    public show(show: boolean): this {
        this.getImpl().show = show
        return this
    }

    public lineNumber(lineNumber: number): this {
        this.getImpl().lineNumber = lineNumber
        return this
    }

    public columnNumber(columnNumber: number): this {
        this.getImpl().columnNumber = columnNumber
        return this
    }
}

export function isCursorEvent(value: unknown): value is CursorEvent {
    return value instanceof CursorEventImpl
}

export function assertIsCursorEvent(
    value: unknown
): asserts value is CursorEvent {
    if (!(value instanceof CursorEventImpl))
        throw Error('Not a CursorEvent!')
}
