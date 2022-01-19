import {Builder} from '@logi-base/src/ts/common/builder'
import {StandardFont} from '@logi-sheets/web/core/standable'
import {
    Alignment,
    AlignmentBuilder,
    Alignment_HorizontalEnum,
    Alignment_VerticalEnum,
    Font,
    isFont,
} from '@logi-pb/network/src/proto/message_pb'

export interface TextAttr {
    readonly font: StandardFont
    readonly alignment: Alignment
}

class TextAttrImpl implements TextAttr {
    public font = new StandardFont()
    public alignment = new AlignmentBuilder()
        .horizontal(Alignment_HorizontalEnum.H_CENTER)
        .vertical(Alignment_VerticalEnum.V_CENTER)
        .build()
}

export class TextAttrBuilder extends Builder<TextAttr, TextAttrImpl> {
    public constructor(obj?: Readonly<TextAttr>) {
        const impl = new TextAttrImpl()
        if (obj)
            TextAttrBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public font(font?: StandardFont | Font): this {
        if (!font)
            return this
        this.getImpl().font = isFont(font) ? StandardFont.from(font) : font
        return this
    }

    public alignment(alignment?: Alignment): this {
        if (!alignment)
            return this
        this.getImpl().alignment = alignment
        return this
    }

    protected get daa(): readonly string[] {
        return TextAttrBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'font',
        'alignment',
    ]
}

export function isTextAttr(value: unknown): value is TextAttr {
    return value instanceof TextAttrImpl
}

export function assertIsTextAttr(value: unknown): asserts value is TextAttr {
    if (!(value instanceof TextAttrImpl))
        throw Error('Not a TextAttr!')
}
