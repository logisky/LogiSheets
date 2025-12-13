import {
    Transaction,
    getFirstCell,
    CellInputBuilder,
    Payload,
    Client,
    Value,
    isErrorMessage,
    Selection,
    toA1notation,
} from 'logisheets-web'

export interface ValueChange {
    sheetIdx: number
    row: number
    col: number
    value?: string
}

export interface Trend {
    sheetIdx: number
    row: number
    col: number
    oldValue: Value
    newValue: Value
}

export function generateValueChange(
    selction: Selection,
    value?: string
): ValueChange | undefined {
    const selectedData = selction.data
    if (selectedData.data === undefined) return
    const sheetIdx = selction.sheetIdx

    const firstCell = getFirstCell(selectedData)
    if (firstCell)
        return {
            sheetIdx,
            row: firstCell.y,
            col: firstCell.x,
            value,
        }
}

export function generateTransaction(
    changes: readonly ValueChange[]
): Transaction {
    const payloads: Payload[] = changes
        .filter((c) => c.value !== undefined)
        .map((c) => {
            return {
                type: 'cellInput',
                value: new CellInputBuilder()
                    .sheetIdx(c.sheetIdx)
                    .row(c.row)
                    .col(c.col)
                    .content(c.value as string)
                    .build(),
            }
        })
    return new Transaction(payloads, true)
}

export async function getTrendsThroughTempTransaction(
    workbook: Client,
    tempTransaction: Transaction
): Promise<readonly Trend[]> {
    const actionEffect = await workbook.handleTransactionWithoutEvents({
        transaction: tempTransaction,
        temp: true,
    })
    if (isErrorMessage(actionEffect)) return []
    await workbook.toggleStatus(true)
    const tempResults = await workbook.batchGetCellInfoById(
        actionEffect.valueChanged
    )
    if (isErrorMessage(tempResults)) return []
    await workbook.toggleStatus(false)
    const originalResults = await workbook.batchGetCellInfoById(
        actionEffect.valueChanged
    )
    if (isErrorMessage(originalResults)) return []

    const coordinates = await workbook.batchGetCellCoordinateWithSheetById(
        actionEffect.valueChanged
    )
    if (isErrorMessage(coordinates)) return []
    await workbook.toggleStatus(true)

    const results: Trend[] = []
    for (let i = 0; i < coordinates.length; i += 1) {
        const sheetIdx = coordinates[i].sheetIdx
        const row = coordinates[i].coordinate.y
        const col = coordinates[i].coordinate.x
        const oldValue = originalResults[i].value
        const newValue = tempResults[i].value
        const trend: Trend = {sheetIdx, row, col, oldValue, newValue}
        results.push(trend)
    }
    return results
}

export async function getDisplayName(
    sheetIdx: number,
    row: number,
    col: number,
    workbook: Client
): Promise<string> {
    const sheetName = await workbook.getSheetNameByIdx(sheetIdx)
    if (isErrorMessage(sheetName)) throw Error('invalid sheetIdx')
    const colName = toA1notation(col)
    return `${sheetName}:${colName}${row + 1}`
}

export function compareValues(
    oldValue: Value,
    newValue: Value
): 'up' | 'down' | 'same' | 'different' {
    if (oldValue === 'empty' && newValue === 'empty') return 'same'
    if (oldValue === 'empty' || newValue === 'empty') return 'different'

    if (oldValue.type !== newValue.type) {
        return 'different'
    }

    if (oldValue.type === 'str') return 'different'

    if (oldValue.type === 'number') {
        const numOld = Number(oldValue.value)
        const numNew = Number(newValue.value)
        if (numNew > numOld) return 'up'
        if (numNew < numOld) return 'down'
        return 'same'
    }

    if (oldValue.type === 'bool') {
        const numOld = oldValue.value ? 1 : 0
        const numNew = newValue.value ? 1 : 0
        if (numNew > numOld) return 'up'
        if (numNew < numOld) return 'down'
        return 'same'
    }
    return 'same'
}

export function cleanupTempStatus(workbook: Client) {
    workbook.cleanupTempStatus()
}

export function getDisplayValue(v: Value): string {
    if (v === 'empty') return ''
    switch (v.type) {
        case 'number':
            return v.value.toString()
        case 'str':
            return `"${v.value}"`
        case 'bool':
            return v.value ? 'TRUE' : 'FALSE'
        case 'error':
            return '#' + v.value
    }
}
