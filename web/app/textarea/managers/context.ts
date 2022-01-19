import {Builder} from '@logi-base/src/ts/common/builder'
import {
    Position,
    PositionBuilder,
} from '@logi-sheets/web/app/textarea/input'
export interface Context {
    readonly text: string
    readonly eof: string
    readonly cellWidth: number
    readonly cellHeight: number
    readonly canvasOffsetX: number
    readonly canvasOffsetY: number
    readonly clientX: number
    readonly clientY: number
    /**
     * -1 means in the end
     */
    readonly textareaOffsetX: number
    /**
     * -1 means in the end
     */
    readonly textareaOffsetY: number
    readonly bindingData?: unknown
    getTexts(start?: Position, end?: Position): readonly string[]
    getOffset(
        clientX: number,
        clientY: number
    ): readonly [offsetX: number, offsetY: number]
    lineHeight(): number
}

class ContextImpl implements Context {
    public text = ''
    public eof = '\n'
    public cellWidth = 0
    public cellHeight = 0
    public clientX!: number
    public clientY!: number
    public canvasOffsetX!: number
    public canvasOffsetY!: number
    public textareaOffsetX = 0
    public textareaOffsetY = 0
    public bindingData?: unknown
    lineHeight(): number {
        return this.cellHeight
    }

    getOffset(
        x: number,
        y: number
    ): readonly [offsetX: number, offsetY: number] {
        return [x - this.clientX, y - this.clientY]
    }

    getTexts(
        startPosition?: Position,
        endPosition?: Position,
    ): readonly string[] {
        const texts = this.text.split(this.eof)
        const start = startPosition ??
            new PositionBuilder().lineNumber(0).column(0).build()
        const endLine = texts.length - 1
        const endCol = texts[endLine].length - 1
        const end = endPosition ??
            new PositionBuilder().lineNumber(endLine).column(endCol).build()
        if (start.lineNumber === end.lineNumber)
            return [texts[start.lineNumber].slice(start.column, end.column + 1)]
        const r: string[] = []
        for (let i = start.lineNumber; i <= end.lineNumber; i += 1)
            if (i === start.lineNumber)
                r.push(texts[i].slice(start.column))
            else if (i === end.lineNumber)
                r.push(texts[i].slice(0, end.column + 1))
            else
                r.push(texts[i])
        return r
    }
}

export class ContextBuilder extends Builder<Context, ContextImpl> {
    public constructor(obj?: Readonly<Context>) {
        const impl = new ContextImpl()
        if (obj)
            ContextBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public text(text: string): this {
        this.getImpl().text = text
        return this
    }

    public eof(eof: string): this {
        this.getImpl().eof = eof
        return this
    }

    public cellWidth(cellWidth: number): this {
        this.getImpl().cellWidth = cellWidth
        return this
    }

    public cellHeight(cellHeight: number): this {
        this.getImpl().cellHeight = cellHeight
        return this
    }

    public canvasOffsetX(canvasOffsetX: number): this {
        this.getImpl().canvasOffsetX = canvasOffsetX
        return this
    }

    public canvasOffsetY(canvasOffsetY: number): this {
        this.getImpl().canvasOffsetY = canvasOffsetY
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

    public textareaOffsetX(textareaOffsetX: number): this {
        this.getImpl().textareaOffsetX = textareaOffsetX
        return this
    }

    public textareaOffsetY(textareaOffsetY: number): this {
        this.getImpl().textareaOffsetY = textareaOffsetY
        return this
    }

    public bindingData(bindingData: unknown): this {
        this.getImpl().bindingData = bindingData
        return this
    }

    protected get daa(): readonly string[] {
        return ContextBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'canvasOffsetX',
        'canvasOffsetY',
        'clientX',
        'clientY',
    ]
}

export function isContext(value: unknown): value is Context {
    return value instanceof ContextImpl
}

export function assertIsContext(value: unknown): asserts value is Context {
    if (!(value instanceof ContextImpl))
        throw Error('Not a Context!')
}
