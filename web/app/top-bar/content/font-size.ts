import {Builder} from '@logi-base/src/ts/common/builder'
export interface FontSize {
    readonly cnName: string
    readonly pt: number
    readonly px: number
    readonly mm: number
}

class FontSizeImpl implements FontSize {
    public cnName!: string
    public pt!: number
    public px!: number
    public mm!: number
}

export class FontSizeBuilder extends Builder<FontSize, FontSizeImpl> {
    public constructor(obj?: Readonly<FontSize>) {
        const impl = new FontSizeImpl()
        if (obj)
            FontSizeBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public cnName(cnName: string): this {
        this.getImpl().cnName = cnName
        return this
    }

    public pt(pt: number): this {
        this.getImpl().pt = pt
        return this
    }

    public px(px: number): this {
        this.getImpl().px = px
        return this
    }

    public mm(mm: number): this {
        this.getImpl().mm = mm
        return this
    }

    protected get daa(): readonly string[] {
        return FontSizeBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'cnName',
        'pt',
        'px',
        'mm',
    ]
}

export function isFontSize(value: unknown): value is FontSize {
    return value instanceof FontSizeImpl
}

export function assertIsFontSize(value: unknown): asserts value is FontSize {
    if (!(value instanceof FontSizeImpl))
        throw Error('Not a FontSize!')
}
// https://max.book118.com/html/2017/0407/99117916.shtm
export const FONT_SIZE_LIST: readonly FontSize[] = [
    new FontSizeBuilder().cnName('1英寸').mm(25.3).pt(72).px(95.6).build(),
    new FontSizeBuilder().cnName('大特号').mm(22.14).pt(63).px(83.7).build(),
    new FontSizeBuilder().cnName('特号').mm(18.97).pt(54).px(71.7).build(),
    new FontSizeBuilder().cnName('初号').mm(14.82).pt(42).px(56).build(),
    new FontSizeBuilder().cnName('小初').mm(12.7).pt(36).px(48).build(),
    new FontSizeBuilder().cnName('一号').mm(9.17).pt(26).px(34.7).build(),
    new FontSizeBuilder().cnName('小一').mm(8.47).pt(24).px(32).build(),
    new FontSizeBuilder().cnName('二号').mm(7.76).pt(22).px(29.3).build(),
    new FontSizeBuilder().cnName('小二').mm(6.35).pt(18).px(24).build(),
    new FontSizeBuilder().cnName('三号').mm(5.64).pt(16).px(21.3).build(),
    new FontSizeBuilder().cnName('小三').mm(5.29).pt(15).px(20).build(),
    new FontSizeBuilder().cnName('四号').mm(4.94).pt(14).px(18.7).build(),
    new FontSizeBuilder().cnName('小四').mm(4.23).pt(12).px(16).build(),
    new FontSizeBuilder().cnName('五号').mm(3.7).pt(10.5).px(14).build(),
    new FontSizeBuilder().cnName('小五').mm(3.18).pt(9).px(12).build(),
    new FontSizeBuilder().cnName('六号').mm(2.56).pt(7.5).px(10).build(),
    new FontSizeBuilder().cnName('小六').mm(2.29).pt(6.5).px(8.7).build(),
    new FontSizeBuilder().cnName('七号').mm(1.94).pt(5.5).px(7.3).build(),
    new FontSizeBuilder().cnName('八号').mm(1.76).pt(5).px(6.7).build(),
]
