import {Builder} from '@logi-base/src/ts/common/builder'
export interface SpanItem {
    readonly text: string
    readonly highlight: boolean
}

class SpanItemImpl implements SpanItem {
    public text!: string
    public highlight = false
}

export class SpanItemBuilder extends Builder<SpanItem, SpanItemImpl> {
    public constructor(obj?: Readonly<SpanItem>) {
        const impl = new SpanItemImpl()
        if (obj)
            SpanItemBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public text(text: string): this {
        this.getImpl().text = text
        return this
    }

    public highlight(highlight: boolean): this {
        this.getImpl().highlight = highlight
        return this
    }

    protected get daa(): readonly string[] {
        return SpanItemBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'text',
        'highlight',
    ]
}

export function isSpanItem(value: unknown): value is SpanItem {
    return value instanceof SpanItemImpl
}

export function assertIsSpanItem(value: unknown): asserts value is SpanItem {
    if (!(value instanceof SpanItemImpl))
        throw Error('Not a SpanItem!')
}
export interface SuggestItem {
    readonly triggerText: string
    readonly suggestFullText: string
    readonly desc: string
    readonly spans: readonly SpanItem[]
    readonly disable: boolean
    readonly lowerCaseText: string
    getString(): string
}

class SuggestItemImpl implements SuggestItem {
    public triggerText = ''
    public suggestFullText = ''
    public desc = ''
    public spans: readonly SpanItem[] = []
    public disable = false
    public get lowerCaseText(): string {
        return this.triggerText.toLocaleLowerCase()
    }

    public getString(): string {
        let result = ''
        this.spans.forEach(s => {
            result += s.text
        })
        return result
    }
}

export class SuggestItemBuilder extends Builder<SuggestItem, SuggestItemImpl> {
    public constructor(obj?: Readonly<SuggestItem>) {
        const impl = new SuggestItemImpl()
        if (obj)
            SuggestItemBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public triggerText(triggerText: string): this {
        this.getImpl().triggerText = triggerText
        return this
    }

    public suggestFullText(suggestFullText: string): this {
        this.getImpl().suggestFullText = suggestFullText
        return this
    }

    public desc(desc: string): this {
        this.getImpl().desc = desc
        return this
    }

    public spans(spans: readonly SpanItem[]): this {
        this.getImpl().spans = spans
        return this
    }

    public disable(disable: boolean): this {
        this.getImpl().disable = disable
        return this
    }

    protected get daa(): readonly string[] {
        return SuggestItemBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'triggerText',
        'desc',
    ]
}

export function isSuggestItem(value: unknown): value is SuggestItem {
    return value instanceof SuggestItemImpl
}

export function assertIsSuggestItem(
    value: unknown
): asserts value is SuggestItem {
    if (!(value instanceof SuggestItemImpl))
        throw Error('Not a SuggestItem!')
}
