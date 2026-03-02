import {
    CellInputBuilder,
    CellStyleUpdateBuilder,
    StyleUpdateTypeBuilder,
    getFirstCell,
} from 'logisheets-web'
import type {
    Payload,
    Selection,
    Transaction,
} from 'logisheets-web'

export function buildTransaction(payloads: Payload[]): Transaction {
    return {payloads, undoable: true, temp: false}
}

export function generatePayloads(
    selection: Selection,
    headers: string[],
    rows: string[][]
): Payload[] {
    if (!selection.data.data) return []
    const firstCell = getFirstCell(selection.data)
    const sheetIdx = selection.sheetIdx
    const payloads: Payload[] = []
    for (let i = 0; i < headers.length; i++) {
        const input: Payload = {
            type: 'cellInput',
            value: new CellInputBuilder()
                .sheetIdx(sheetIdx)
                .row(firstCell.y)
                .col(firstCell.x + i)
                .content(headers[i])
                .build(),
        }
        const font: Payload = {
            type: 'cellStyleUpdate',
            value: new CellStyleUpdateBuilder()
                .sheetIdx(sheetIdx)
                .row(firstCell.y)
                .col(firstCell.x + i)
                .ty(new StyleUpdateTypeBuilder().setFontBold(true).build())
                .build(),
        }
        payloads.push(input)
        payloads.push(font)
    }

    for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < rows[i].length; j++) {
            const input: Payload = {
                type: 'cellInput',
                value: new CellInputBuilder()
                    .sheetIdx(sheetIdx)
                    .row(firstCell.y + i + 1)
                    .col(firstCell.x + j)
                    .content(rows[i][j])
                    .build(),
            }
            payloads.push(input)
        }
    }
    return payloads
}
