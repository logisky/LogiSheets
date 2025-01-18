import {SelectedData} from '@/components/canvas'
import {Payload, SetFontBuilder} from 'logisheets-web'

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
                const builder = new SetFontBuilder()
                    .sheetIdx(sheetIdx)
                    .row(i)
                    .col(j)
                if (bold !== undefined) builder.bold(bold)
                if (underlined !== underlined) builder.underline('single')
                if (italic !== undefined) builder.italic(italic)
                const p = builder.build()
                result.push(p)
            }
        }
    }
    return []
}
