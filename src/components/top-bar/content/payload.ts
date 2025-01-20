import {SelectedData} from '@/components/canvas'
import {
    Alignment,
    Payload,
    SetCellAlignmentBuilder,
    SetCellFontBuilder,
    SetLineAlignmentBuilder,
    SetLineFontBuilder,
} from 'logisheets-web'

export interface FontStyle {
    bold?: boolean
    underline?: boolean
    italic?: boolean
    color?: string
}
export function generateFontPayload(
    sheetIdx: number,
    data: SelectedData,
    update: FontStyle
): readonly Payload[] {
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
                if (update.bold !== undefined) builder.bold(update.bold)
                if (update.underline !== undefined)
                    builder.underline(update.underline ? 'single' : 'none')
                if (update.italic !== undefined) builder.italic(update.italic)
                if (update.color) builder.color(update.color)
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
        if (update.bold !== undefined) builder.bold(update.bold)
        if (update.underline !== undefined)
            builder.underline(update.underline ? 'single' : 'none')
        if (update.italic !== undefined) builder.italic(update.italic)
        if (update.color) builder.color(update.color)
        const p = builder.build()
        result.push(p)
    }
    return result
}

export function generateAlgnmentPayload(
    sheetIdx: number,
    data: SelectedData,
    alignment: Alignment
): readonly Payload[] {
    if (!data.data) return []
    const result: Payload[] = []
    const t = data.data.ty
    if (t === 'cellRange') {
        const d = data.data.d
        for (let i = d.startRow; i <= d.endRow; i += 1) {
            for (let j = d.startCol; j <= d.endCol; j += 1) {
                const p = new SetCellAlignmentBuilder()
                    .sheetIdx(sheetIdx)
                    .row(i)
                    .col(j)
                    .alignment(alignment)
                    .build()
                result.push(p)
            }
        }
    } else {
        const d = data.data.d
        const p = new SetLineAlignmentBuilder()
            .sheetIdx(sheetIdx)
            .row(d.type === 'row')
            .from(d.start)
            .to(d.end)
            .alignment(alignment)
            .build()
        result.push(p)
    }
    return result
}
