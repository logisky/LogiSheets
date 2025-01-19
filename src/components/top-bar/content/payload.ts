import {SelectedData} from '@/components/canvas'
import {Payload, SetCellFontBuilder, SetLineFontBuilder} from 'logisheets-web'

export function generateFontPayload(
    sheetIdx: number,
    data: SelectedData,
    bold?: boolean,
    underlined?: boolean,
    italic?: boolean
): Payload[] {
    if (!data.data) return []
    const result: Payload[] = []
    const t = data.data.ty
    if (t === 'cellRange') {
        const d = data.data.d
        for (let i = d.startRow; i <= d.endRow; i += 1) {
            for (let j = d.startCol; j <= d.endCol; j += 1) {
                const builder = new SetCellFontBuilder()
                    .sheetIdx(sheetIdx)
                    .row(i)
                    .col(j)
                if (bold !== undefined) builder.bold(bold)
                if (underlined !== undefined) builder.underline('single')
                if (italic !== undefined) builder.italic(italic)
                const p = builder.build()
                result.push(p)
            }
        }
    } else {
        const d = data.data.d
        const builder = new SetLineFontBuilder()
            .sheetIdx(sheetIdx)
            .row(d.type === 'row')
            .from(d.start)
            .to(d.end)
        if (bold !== undefined) builder.bold(bold)
        if (underlined !== undefined) builder.underline('single')
        if (italic !== undefined) builder.italic(italic)
        const p = builder.build()
        result.push(p)
    }
    return result
}
