import {Builder} from '@logi-base/src/ts/common/builder'
export function setDataToCopy(
    data: ClipboardStoredMetaData,
    e: ClipboardEvent
): void {
    if (e.clipboardData)
        data.clipboardMetaData.forEach(d => {
            e.clipboardData?.setData(d.format, d.text)
        })
    // tslint:disable-next-line: no-throw-unless-asserts
    throw Error('Can not set data to copy')
}

export function canUseTextData(e: ClipboardEvent): boolean {
    if (e.clipboardData)
        return true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (navigator.clipboard)
        return true
    return false
}

export function getExcelClipboardData(text: string): ExcelClipboardData {
    console.log(text)
    return new ExcelClipboardDataBuilder().sheetname('').build()
}

export function getClipboardData(e: ClipboardEvent): ClipboardStoredMetaData {
    if (e.clipboardData) {
        e.preventDefault()
        const data: ClipboardMetaData[] = []
        e.clipboardData.types.forEach(type => {
            const d = new ClipboardMetaDataBuilder().format(type)
            const text = e.clipboardData?.getData(type) ?? ''
            data.push(d.text(text).build())
        })
        return new ClipboardStoredMetaDataBuilder()
            .clipboardMetaData(data)
            .build()
    }
    // tslint:disable-next-line: no-throw-unless-asserts
    throw Error(`cannot get clipboard data ${e}`)
}
export interface ClipboardStoredMetaData {
    readonly clipboardMetaData: readonly ClipboardMetaData[]
}

class ClipboardStoredMetaDataImpl implements ClipboardStoredMetaData {
    public clipboardMetaData: readonly ClipboardMetaData[] = []
}

export class ClipboardStoredMetaDataBuilder extends Builder<ClipboardStoredMetaData, ClipboardStoredMetaDataImpl> {
    public constructor(obj?: Readonly<ClipboardStoredMetaData>) {
        const impl = new ClipboardStoredMetaDataImpl()
        if (obj)
            ClipboardStoredMetaDataBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public clipboardMetaData(
        clipboardMetaData: readonly ClipboardMetaData[]
    ): this {
        this.getImpl().clipboardMetaData = clipboardMetaData
        return this
    }
}

export function isClipboardStoredMetaData(
    value: unknown
): value is ClipboardStoredMetaData {
    return value instanceof ClipboardStoredMetaDataImpl
}

export function assertIsClipboardStoredMetaData(
    value: unknown
): asserts value is ClipboardStoredMetaData {
    if (!(value instanceof ClipboardStoredMetaDataImpl))
        throw Error('Not a ClipboardStoredMetaData!')
}

export interface ClipboardMetaData {
    /**
     * Defined in './mime.ts'
     */
    readonly format: string
    readonly text: string
}

class ClipboardMetaDataImpl implements ClipboardMetaData {
    public format!: string
    public text!: string
}

export class ClipboardMetaDataBuilder extends Builder<ClipboardMetaData, ClipboardMetaDataImpl> {
    public constructor(obj?: Readonly<ClipboardMetaData>) {
        const impl = new ClipboardMetaDataImpl()
        if (obj)
            ClipboardMetaDataBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public format(type: string): this {
        this.getImpl().format = type
        return this
    }

    public text(text: string): this {
        this.getImpl().text = text
        return this
    }

    protected get daa(): readonly string[] {
        return ClipboardMetaDataBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'format',
        'text',
    ]
}

export function isClipboardMetaData(
    value: unknown
): value is ClipboardMetaData {
    return value instanceof ClipboardMetaDataImpl
}

export function assertIsClipboardMetaData(
    value: unknown
): asserts value is ClipboardMetaData {
    if (!(value instanceof ClipboardMetaDataImpl))
        throw Error('Not a ClipboardMetaData!')
}
export interface ExcelClipboardData {
    readonly sheetname: string
}

class ExcelClipboardDataImpl implements ExcelClipboardData {
    public sheetname!: string
}

export class ExcelClipboardDataBuilder extends Builder<ExcelClipboardData, ExcelClipboardDataImpl> {
    public constructor(obj?: Readonly<ExcelClipboardData>) {
        const impl = new ExcelClipboardDataImpl()
        if (obj)
            ExcelClipboardDataBuilder.shallowCopy(impl, obj)
        super(impl)
    }

    public sheetname(sheetname: string): this {
        this.getImpl().sheetname = sheetname
        return this
    }

    protected get daa(): readonly string[] {
        return ExcelClipboardDataBuilder.__DAA_PROPS__
    }

    protected static readonly __DAA_PROPS__: readonly string[] = [
        'sheetname',
    ]
}

export function isExcelClipboardData(
    value: unknown
): value is ExcelClipboardData {
    return value instanceof ExcelClipboardDataImpl
}

export function assertIsExcelClipboardData(
    value: unknown
): asserts value is ExcelClipboardData {
    if (!(value instanceof ExcelClipboardDataImpl))
        throw Error('Not a ExcelClipboardData!')
}
