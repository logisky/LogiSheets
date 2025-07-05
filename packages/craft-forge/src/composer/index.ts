export * from './types'

import {
    CellInputBuilder,
    CreateAppendixBuilder,
    CreateBlockBuilder,
    Payload,
} from 'logisheets-web'
import {CraftDescriptor, Cell} from './types'

export function generatePayloads(
    sheetIdx: number,
    blockId: number,
    masterRow: number,
    masterCol: number,
    craftDescriptor: CraftDescriptor
): readonly Payload[] {
    if (!craftDescriptor.wb) {
        throw new Error('Craft descriptor must have a workbook part')
    }
    const result: Payload[] = []
    const createBlock = new CreateBlockBuilder()
        .sheetIdx(sheetIdx)
        .id(blockId)
        .masterRow(masterRow)
        .masterCol(masterCol)
        .rowCnt(craftDescriptor.wb.rowCount)
        .colCnt(craftDescriptor.wb.colCount)
        .build() as Payload
    result.push(createBlock)

    craftDescriptor.wb.cells.forEach((cell: Cell) => {
        if (cell.formula) {
            const cellInput = new CellInputBuilder()
                .sheetIdx(sheetIdx)
                .row(cell.row + masterRow)
                .col(cell.col + masterCol)
                .content(cell.formula)
                .build() as Payload
            result.push(cellInput)
        } else if (cell.value) {
            const cellInput = new CellInputBuilder()
                .sheetIdx(sheetIdx)
                .row(cell.row + masterRow)
                .col(cell.col + masterCol)
                .content(cell.value.valueStr)
                .build() as Payload
            result.push(cellInput)
        }

        if (cell.appendix) {
            const addAppendix = new CreateAppendixBuilder()
                .sheetIdx(sheetIdx)
                .blockId(blockId)
                .tag(cell.appendix.tag)
                .content(cell.appendix.content)
                .rowIdx(cell.row)
                .colIdx(cell.col)
                .build() as Payload
            result.push(addAppendix)
            // todo: add style payloads
        }
    })
    return result
}
