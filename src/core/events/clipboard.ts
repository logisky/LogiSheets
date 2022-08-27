export function setDataToCopy(
    data: ClipboardStoredMetaData,
    e: ClipboardEvent
): void {
    if (e.clipboardData)
        data.clipboardMetaData.forEach((d) => {
            e.clipboardData?.setData(d.format, d.text)
        })
    // tslint:disable-next-line: no-throw-unless-asserts
    throw Error('Can not set data to copy')
}

export function canUseTextData(e: ClipboardEvent): boolean {
    if (e.clipboardData) return true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (navigator.clipboard) return true
    return false
}

export function getExcelClipboardData(text: string): ExcelClipboardData {
    const d = new ExcelClipboardData()
    d.sheetname = text
    return d
}

export function getClipboardData(e: ClipboardEvent): ClipboardStoredMetaData {
    if (e.clipboardData) {
        e.preventDefault()
        const data: ClipboardMetaData[] = []
        e.clipboardData.types.forEach((type) => {
            const d = new ClipboardMetaData()
            d.format = type
            d.text = e.clipboardData?.getData(type) ?? ''
            data.push(d)
        })
        return {
            clipboardMetaData: data,
        }
    }
    // tslint:disable-next-line: no-throw-unless-asserts
    throw Error(`cannot get clipboard data ${e}`)
}
export class ClipboardStoredMetaData {
    constructor(public clipboardMetaData: readonly ClipboardMetaData[] = []) {}
}

export class ClipboardMetaData {
    /**
     * Defined in './mime.ts'
     */
    public format = ''
    public text = ''
}
export class ExcelClipboardData {
    public sheetname = ''
}
