import {
    Payload,
    CellInputBuilder,
    SetCellFontBuilder,
    getFirstCell,
    Selection,
    Transaction,
} from 'logisheets-web'

export function buildTransaction(payloads: Payload[]): Transaction {
    return new Transaction(payloads, true)
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
        const input = {
            type: 'cellInput',
            value: new CellInputBuilder()
                .sheetIdx(sheetIdx)
                .row(firstCell.y)
                .col(firstCell.x + i)
                .content(headers[i])
                .build(),
        } as Payload
        const font = {
            type: 'setCellFont',
            value: new SetCellFontBuilder()
                .sheetIdx(sheetIdx)
                .row(firstCell.y)
                .col(firstCell.x + i)
                .bold(true)
                .build(),
        } as Payload
        payloads.push(input)
        payloads.push(font)
    }

    for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < rows[i].length; j++) {
            const input = {
                type: 'cellInput',
                value: new CellInputBuilder()
                    .sheetIdx(sheetIdx)
                    .row(firstCell.y + i + 1)
                    .col(firstCell.x + j)
                    .content(rows[i][j])
                    .build(),
            } as Payload
            payloads.push(input)
        }
    }
    return payloads
}
